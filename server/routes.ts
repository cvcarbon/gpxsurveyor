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
    // Convert polygon to Turf.js format
    const polygonFeature = turf.polygon(polygon.geometry.coordinates);
    
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
    
    // Calculate polygon extent in the perpendicular direction to survey lines
    // This ensures complete coverage regardless of bearing
    const polygonPoints = polygon.geometry.coordinates[0];
    
    // Project all polygon points onto the perpendicular axis
    const perpProjections = polygonPoints.map((point: number[]) => 
      point[0] * P[0] + point[1] * P[1]
    );
    
    const minProj = Math.min(...perpProjections);
    const maxProj = Math.max(...perpProjections);
    const projectedWidth = maxProj - minProj;
    
    // Calculate number of lines needed with proper spacing
    const lineCount = Math.ceil(projectedWidth / (effectiveDistance / 111000)) + 2; // Add buffer lines
    
    // Calculate maximum dimension for line length
    const polygonCenter = turf.center(polygonFeature);
    const maxDim = Math.max(maxX - minX, maxY - minY);
    const lineLength = maxDim * 2; // Ensure lines are long enough to cross entire polygon
    
    // First pass: Generate all transect lines
    for (let i = 0; i < lineCount; i++) {
      // Calculate offset in perpendicular direction
      const offset = minProj + (i * effectiveDistance / 111000);
      
      // Calculate base point for this line
      const centerCoords = polygonCenter.geometry.coordinates;
      const currentProj = centerCoords[0] * P[0] + centerCoords[1] * P[1];
      const shift = offset - currentProj;
      const basePoint = [
        centerCoords[0] + shift * P[0],
        centerCoords[1] + shift * P[1]
      ];
      
      // Create line extending in both directions along survey bearing
      const halfLen = lineLength / 2;
      const startPoint = [
        basePoint[0] - halfLen * D[0],
        basePoint[1] - halfLen * D[1]
      ];
      const endPoint = [
        basePoint[0] + halfLen * D[0],
        basePoint[1] + halfLen * D[1]
      ];
      
      const line = turf.lineString([startPoint, endPoint]);
      
      // Clip line to polygon
      try {
        const clippedLine = turf.lineIntersect(line, polygonFeature);
        if (clippedLine.features.length >= 2) {
          // Convert intersection points to line
          const coords = clippedLine.features.map(f => f.geometry.coordinates);
          
          // Sort coordinates along the survey direction
          const sortedCoords = coords.sort((a, b) => {
            const projA = a[0] * D[0] + a[1] * D[1];
            const projB = b[0] * D[0] + b[1] * D[1];
            return projA - projB;
          });
          
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
    
    // Calculate direction vectors exactly like Python reference
    // Python: dx = math.sin(angle_rad), dy = math.cos(angle_rad)
    // Python: D = (dx, dy), P = (dy, -dx)
    const dx = Math.sin(bearingRad);
    const dy = Math.cos(bearingRad);
    const D = [dx, dy]; // Direction vector (along transect lines)
    const P = [dy, -dx]; // Perpendicular vector (across transect spacing)
    
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
        
        // Calculate geometric turn direction using cross product
        // This ensures curves always turn outward regardless of bearing
        const currentLineVec = [travelEnd[0] - travelStart[0], travelEnd[1] - travelStart[1]];
        const nextLineVec = [nextTravelStart[0] - travelEnd[0], nextTravelStart[1] - travelEnd[1]];
        
        // Cross product to determine turn direction 
        const crossProduct = currentLineVec[0] * nextLineVec[1] - currentLineVec[1] * nextLineVec[0];
        // Invert the logic to ensure outward curves
        const turnRight = crossProduct < 0;
        
        // Following Python method for point alignment
        const P_end = travelEnd;
        const P_next = nextTravelStart;
        const p_end_D = P_end[0] * D[0] + P_end[1] * D[1];
        
        const T1 = P_end;
        const T2 = alignPoint(P_next, p_end_D, D);
        
        // Calculate chord distance and radius exactly like Python
        // Python: chord_dx = T2.X - T1.X
        // Python: chord_dy = T2.Y - T1.Y 
        // Python: chord_dist = math.hypot(chord_dx, chord_dy)
        // Python: R = chord_dist / 2.0
        const chord_dx = T2[0] - T1[0];
        const chord_dy = T2[1] - T1[1];
        const chord_dist = Math.sqrt(chord_dx * chord_dx + chord_dy * chord_dy);
        const R = chord_dist / 2.0;
        
        // Calculate arc center exactly like Python
        // Python: centerX = (T1.X + T2.X) / 2.0
        // Python: centerY = (T1.Y + T2.Y) / 2.0
        const centerX = (T1[0] + T2[0]) / 2.0;
        const centerY = (T1[1] + T2[1]) / 2.0;
        
        // Calculate start angle exactly like Python
        // Python: start_angle = math.atan2(T1.Y - centerY, T1.X - centerX)
        const start_angle = Math.atan2(T1[1] - centerY, T1[0] - centerX);
        
        // Generate arc points exactly like Python
        const segments = 12; // Python: segments = 12
        if (turnRight) {
          // Python: theta = start_angle - (math.pi * j / segments)
          for (let j = 1; j < segments; j++) {
            const theta = start_angle - (Math.PI * j / segments);
            const x = centerX + R * Math.cos(theta);
            const y = centerY + R * Math.sin(theta);
            waypoints.push({ lat: y, lng: x });
          }
        } else {
          // Python: theta = start_angle + (math.pi * j / segments)
          for (let j = 1; j < segments; j++) {
            const theta = start_angle + (Math.PI * j / segments);
            const x = centerX + R * Math.cos(theta);
            const y = centerY + R * Math.sin(theta);
            waypoints.push({ lat: y, lng: x });
          }
        }
        
        // Add the aligned T2 point
        // Python: route_points.append(arcpy.Point(T2.X, T2.Y))
        waypoints.push({ lat: T2[1], lng: T2[0] });
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
    
  } catch (error: unknown) {
    console.error("Error generating transect route:", error);
    throw new Error("Failed to generate transect route");
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
