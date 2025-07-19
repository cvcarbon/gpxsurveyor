import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { routeParametersSchema } from "@shared/schema";
import * as turf from "@turf/turf";
import * as xml2js from "xml2js";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Upload polygon files (KML/SHP)
  app.post("/api/upload-polygon", upload.array("files"), async (req: any, res: Response) => {
    try {
      console.log("File upload request received");
      console.log("Request files:", req.files);
      console.log("Request body:", req.body);
      
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        console.log("No files found in request");
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedFiles = [];
      const polygons = [];

      for (const file of files) {
        console.log(`Processing file: ${file.originalname}, type: ${file.mimetype}`);
        let polygon = null;
        let fileData = null;

        if (file.mimetype.includes("kml") || file.originalname.endsWith(".kml")) {
          console.log("Parsing KML file");
          const result = await parseKML(file.buffer);
          polygon = result.polygon;
          fileData = result.data;
        } else if (file.mimetype.includes("zip") || file.originalname.endsWith(".shp")) {
          console.log("Parsing SHP file");
          const result = await parseSHP(file.buffer);
          polygon = result.polygon;
          fileData = result.data;
        } else {
          console.log(`Unsupported file type: ${file.mimetype}`);
          continue;
        }

        if (polygon) {
          console.log("Polygon extracted successfully");
          const uploadedFile = await storage.createUploadedFile({
            fileName: file.originalname,
            fileType: file.originalname.endsWith(".kml") ? "kml" : "shp",
            fileData,
            polygon,
          });
          
          uploadedFiles.push(uploadedFile);
          polygons.push(polygon);
        } else {
          console.log("No polygon extracted from file");
        }
      }

      console.log(`Successfully processed ${polygons.length} files`);
      res.json({ files: uploadedFiles, polygons });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to process uploaded files", error: error.message });
    }
  });

  // Generate transect route
  app.post("/api/generate-route", async (req, res) => {
    try {
      const { polygon, parameters, name } = req.body;
      
      if (!polygon || !parameters) {
        return res.status(400).json({ message: "Polygon and parameters required" });
      }

      // Validate parameters
      const validParams = routeParametersSchema.parse(parameters);
      
      // Generate transect lines
      const route = await generateTransectRoute(polygon, validParams);
      
      // Use provided name or generate default
      const routeName = name?.trim() || `Route ${Date.now()}`;
      
      // Save route
      const savedRoute = await storage.createRoute({
        name: routeName,
        polygon,
        distance: validParams.distance,
        bearing: validParams.bearing,
        overlap: validParams.overlap,
        turnRadius: validParams.turnRadius,
        transectLines: route.transectLines,
        waypoints: route.waypoints,
        totalDistance: route.totalDistance,
        estimatedTime: route.estimatedTime,
      });

      res.json(savedRoute);
    } catch (error) {
      console.error("Route generation error:", error);
      res.status(500).json({ message: "Failed to generate route" });
    }
  });

  // Get route by ID
  app.get("/api/routes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const route = await storage.getRoute(id);
      
      if (!route) {
        return res.status(404).json({ message: "Route not found" });
      }

      res.json(route);
    } catch (error) {
      res.status(500).json({ message: "Failed to get route" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Route generation algorithm
async function generateTransectRoute(polygon: any, parameters: any) {
  try {
    console.log("Starting route generation with:");
    console.log("Polygon:", JSON.stringify(polygon, null, 2));
    console.log("Parameters:", JSON.stringify(parameters, null, 2));
    // Convert polygon to Turf feature if needed
    let polygonFeature;
    console.log("Processing polygon type:", polygon?.type);
    
    if (polygon?.type === 'Polygon') {
      console.log("Creating polygon from coordinates");
      polygonFeature = turf.polygon(polygon.coordinates);
    } else if (polygon?.type === 'Feature' && polygon?.geometry?.type === 'Polygon') {
      console.log("Using existing feature polygon");
      polygonFeature = polygon;
    } else {
      console.error("Invalid polygon format. Received:", polygon);
      throw new Error(`Invalid polygon format: expected Polygon or Feature, got ${polygon?.type}`);
    }
    
    console.log("Polygon feature created successfully");
    
    // Calculate bounding box
    const bbox = turf.bbox(polygonFeature);
    const [minX, minY, maxX, maxY] = bbox;
    
    // Convert bearing to radians
    const bearingRad = (parameters.bearing * Math.PI) / 180;
    
    // Generate parallel lines
    const transectLines = [];
    const waypoints = [];
    
    // Calculate line spacing (accounting for overlap)
    const effectiveDistance = parameters.distance * (1 - parameters.overlap / 100);
    
    // Generate transect lines based on bearing
    const lineCount = Math.ceil((maxX - minX) / (effectiveDistance / 111000)); // Rough conversion to degrees
    
    // First pass: Generate all transect lines
    for (let i = 0; i < lineCount; i++) {
      const x = minX + (i * effectiveDistance / 111000);
      
      // Create line from south to north of bounding box
      const line = turf.lineString([
        [x, minY - 0.01],
        [x, maxY + 0.01]
      ]);
      
      // Rotate line by bearing
      const rotatedLine = turf.transformRotate(line, parameters.bearing, { pivot: turf.center(polygonFeature) });
      
      // Clip line to polygon
      try {
        const clippedLine = turf.lineIntersect(rotatedLine, polygonFeature);
        if (clippedLine.features.length >= 2) {
          // Convert intersection points to line, sort by latitude for consistency
          const coords = clippedLine.features.map(f => f.geometry.coordinates);
          const sortedCoords = coords.sort((a, b) => a[1] - b[1]); // Sort by latitude
          const transectLine = turf.lineString([sortedCoords[0], sortedCoords[sortedCoords.length - 1]]);
          transectLines.push(transectLine);
        }
      } catch (e) {
        console.warn("Failed to clip line to polygon:", e);
      }
    }

    // Second pass: Create alternating waypoint path with curved U-turns
    // Following the Python reference method for smooth curve generation
    const turnRadiusMeters = parameters.turnRadius || (parameters.distance * 0.5);
    
    // Use existing bearingRad from above for direction vector calculations
    const D = [Math.sin(bearingRad), Math.cos(bearingRad)]; // Direction vector
    
    // Helper function to align points in survey direction (like Python adjust_point)
    const alignPoint = (point: number[], target: number, directionVector: number[]) => {
      const current = point[0] * directionVector[0] + point[1] * directionVector[1];
      const shift = target - current;
      return [
        point[0] + shift * directionVector[0],
        point[1] + shift * directionVector[1]
      ];
    };
    
    // Build route with alternating pattern and curved turns
    for (let i = 0; i < transectLines.length; i++) {
      const line = transectLines[i];
      const lineCoords = line.geometry.coordinates;
      const start = lineCoords[0];
      const end = lineCoords[1];
      
      let travelStart: number[], travelEnd: number[];
      
      if (i % 2 === 0) {
        // Even lines: go from start to end
        travelStart = start;
        travelEnd = end;
      } else {
        // Odd lines: go from end to start (alternating pattern)
        travelStart = end;
        travelEnd = start;
      }
      
      if (i === 0) {
        // First line: add waypoints along the entire line
        const lineString = turf.lineString([travelStart, travelEnd]);
        const lineLength = turf.length(lineString, { units: 'kilometers' });
        const numWaypoints = Math.max(2, Math.ceil(lineLength * 10)); // About 10 waypoints per km
        
        for (let j = 0; j <= numWaypoints; j++) {
          const progress = j / numWaypoints;
          const point = turf.along(lineString, progress * lineLength, { units: 'kilometers' });
          waypoints.push({ lat: point.geometry.coordinates[1], lng: point.geometry.coordinates[0] });
        }
      } else {
        // For subsequent lines, add waypoints along the line (start is connected by curve)
        const lineString = turf.lineString([travelStart, travelEnd]);
        const lineLength = turf.length(lineString, { units: 'kilometers' });
        const numWaypoints = Math.max(2, Math.ceil(lineLength * 10)); // About 10 waypoints per km
        
        // Skip the first waypoint (it's connected by the curve) and add the rest
        for (let j = 1; j <= numWaypoints; j++) {
          const progress = j / numWaypoints;
          const point = turf.along(lineString, progress * lineLength, { units: 'kilometers' });
          waypoints.push({ lat: point.geometry.coordinates[1], lng: point.geometry.coordinates[0] });
        }
      }
      
      // Add curved turn between this line and the next
      if (i < transectLines.length - 1) {
        const nextLine = transectLines[i + 1];
        const nextStart = nextLine.geometry.coordinates[0];
        const nextEnd = nextLine.geometry.coordinates[1];
        
        // Determine next line's travel direction
        let nextTravelStart: number[];
        if ((i + 1) % 2 === 0) {
          nextTravelStart = nextStart;
        } else {
          nextTravelStart = nextEnd;
        }
        
        // Current turn direction - determine based on bearing and line index
        let turnRight = (i % 2 === 0);
        // For 0-degree bearing, keep original logic
        // For other bearings, adjust based on quadrant
        if (parameters.bearing >= 45 && parameters.bearing < 135) {
          // East quadrant (45-135 degrees)
          turnRight = !turnRight;
        } else if (parameters.bearing >= 135 && parameters.bearing < 225) {
          // South quadrant (135-225 degrees)
          turnRight = !turnRight;
        } else if (parameters.bearing >= 225 && parameters.bearing < 315) {
          // West quadrant (225-315 degrees)
          turnRight = !turnRight;
        }
        // North quadrant (315-45 degrees) keeps original logic
        
        // Following Python method: align points in survey direction
        let T1 = travelEnd;
        const T1_proj = T1[0] * D[0] + T1[1] * D[1];
        const nextProj = nextTravelStart[0] * D[0] + nextTravelStart[1] * D[1];
        
        // Check if we need to extend based on alternating pattern
        // Use a more robust extension logic that considers the geometric relationship
        let needsExtension = false;
        const projectionDiff = nextProj - T1_proj;
        
        // Extension logic: extend if the next line's start is significantly ahead/behind
        // in the survey direction compared to current line's end
        if (Math.abs(projectionDiff) > 0.00001) { // Only extend if there's a meaningful difference
          if (i % 2 === 0) {
            // Even lines: extend if next is ahead in survey direction
            needsExtension = projectionDiff > 0;
          } else {
            // Odd lines: extend if next is behind in survey direction
            needsExtension = projectionDiff < 0;
          }
        }
        
        if (needsExtension) {
          const extensionInSurveyDirection = Math.abs(projectionDiff) + 0.0002; // Slightly larger buffer
          const extensionDirection = projectionDiff > 0 ? 1 : -1;
          
          T1 = [
            T1[0] + extensionInSurveyDirection * extensionDirection * D[0],
            T1[1] + extensionInSurveyDirection * extensionDirection * D[1]
          ];
          
          // Add waypoint for the extended endpoint
          waypoints.push({ lat: T1[1], lng: T1[0] });
        }
        
        const T2 = alignPoint(nextTravelStart, T1[0] * D[0] + T1[1] * D[1], D);
        
        // Calculate chord distance and radius
        const chordDx = T2[0] - T1[0];
        const chordDy = T2[1] - T1[1];
        const chordDist = Math.sqrt(chordDx * chordDx + chordDy * chordDy);
        
        // Ensure minimum chord distance for proper curve generation
        if (chordDist < 0.00001) {
          // If points are too close, just add a direct waypoint
          waypoints.push({ lat: T2[1], lng: T2[0] });
        } else {
          const R = chordDist / 2.0;
          
          // Calculate arc center
          const centerX = (T1[0] + T2[0]) / 2.0;
          const centerY = (T1[1] + T2[1]) / 2.0;
          
          // Calculate start angle
          const startAngle = Math.atan2(T1[1] - centerY, T1[0] - centerX);
          
          // Generate arc points (following Python method)
          const segments = 12;
          for (let j = 1; j < segments; j++) {
            let theta: number;
            if (turnRight) {
              theta = startAngle - (Math.PI * j / segments);
            } else {
              theta = startAngle + (Math.PI * j / segments);
            }
            
            const x = centerX + R * Math.cos(theta);
            const y = centerY + R * Math.sin(theta);
            
            waypoints.push({ lat: y, lng: x });
          }
          
          // Add the aligned T2 point
          waypoints.push({ lat: T2[1], lng: T2[0] });
        }
      }
    }

    
    // Calculate total distance
    let totalDistance = 0;
    for (const line of transectLines) {
      totalDistance += turf.length(line, { units: "meters" });
    }
    
    // Add turn distances
    const turnDistance = waypoints.length * parameters.turnRadius * Math.PI / 2;
    totalDistance += turnDistance;
    
    // Estimate time (assuming 5 m/s average speed)
    const estimatedTime = Math.round(totalDistance / 5 / 60);
    
    return {
      transectLines,
      waypoints,
      totalDistance: Math.round(totalDistance),
      estimatedTime,
      bearing: parameters.bearing,
      distance: parameters.distance,
    };
    
  } catch (error) {
    console.error("Error generating transect route:", error);
    console.error("Stack trace:", error.stack);
    console.error("Input polygon:", JSON.stringify(polygon, null, 2));
    console.error("Input parameters:", JSON.stringify(parameters, null, 2));
    throw new Error(`Failed to generate transect route: ${error.message}`);
  }
}

// File parsing utilities
const parseKML = async (buffer: Buffer): Promise<{ polygon: any; data: any }> => {
  const parser = new xml2js.Parser();
  
  try {
    const result = await parser.parseStringPromise(buffer.toString());
    
    // Extract coordinates from KML (simplified)
    const coordinates = extractKMLCoordinates(result);
    
    if (coordinates) {
      const polygon = turf.polygon([coordinates]);
      return { polygon: polygon, data: result };
    }
    
    throw new Error("No valid polygon found in KML");
  } catch (error) {
    throw new Error("Failed to parse KML file");
  }
};

const parseSHP = async (buffer: Buffer): Promise<{ polygon: any; data: any }> => {
  // SHP parsing would require a proper library like shapefile
  // For now, return error
  throw new Error("SHP file parsing not implemented yet");
};

const extractKMLCoordinates = (kmlData: any): number[][] | null => {
  try {
    console.log("Extracting KML coordinates from:", JSON.stringify(kmlData, null, 2));
    
    // Navigate KML structure to find coordinates
    const doc = kmlData.kml?.Document?.[0] || kmlData.kml;
    const folder = doc?.Folder?.[0] || doc;
    const placemarks = folder?.Placemark || doc?.Placemark || [];
    
    console.log("Found placemarks:", placemarks.length);
    
    for (const placemark of placemarks) {
      console.log("Processing placemark:", Object.keys(placemark));
      
      // Check for MultiGeometry first (like in your KML)
      const multiGeometry = placemark.MultiGeometry?.[0];
      if (multiGeometry) {
        console.log("Found MultiGeometry");
        const polygon = multiGeometry.Polygon?.[0];
        if (polygon) {
          const coords = polygon.outerBoundaryIs?.[0]?.LinearRing?.[0]?.coordinates?.[0];
          if (coords) {
            console.log("Found coordinates in MultiGeometry:", coords.substring(0, 100));
            return parseCoordinateString(coords);
          }
        }
      }
      
      // Check for direct Polygon
      const polygon = placemark.Polygon?.[0];
      if (polygon) {
        console.log("Found direct Polygon");
        const coords = polygon.outerBoundaryIs?.[0]?.LinearRing?.[0]?.coordinates?.[0];
        if (coords) {
          console.log("Found coordinates in Polygon:", coords.substring(0, 100));
          return parseCoordinateString(coords);
        }
      }
    }
    
    console.log("No coordinates found in KML");
    return null;
  } catch (error) {
    console.error("Error extracting KML coordinates:", error);
    return null;
  }
};

const parseCoordinateString = (coords: string): number[][] => {
  // Parse coordinate string "lng,lat,alt lng,lat,alt ..." or "lng,lat,alt\nlng,lat,alt..."
  const coordPairs = coords.trim().split(/[\s\n]+/).filter(pair => pair.trim().length > 0);
  console.log("Coordinate pairs found:", coordPairs.length);
  
  return coordPairs.map((pair: string) => {
    const [lng, lat, alt] = pair.split(',').map(Number);
    return [lng, lat]; // Only return lng, lat (ignore altitude)
  }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1])); // Filter out invalid coordinates
};
