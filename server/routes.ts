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
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedFiles = [];
      const polygons = [];

      for (const file of files) {
        let polygon = null;
        let fileData = null;

        if (file.mimetype.includes("kml") || file.originalname.endsWith(".kml")) {
          const result = await parseKML(file.buffer);
          polygon = result.polygon;
          fileData = result.data;
        } else if (file.mimetype.includes("zip") || file.originalname.endsWith(".shp")) {
          const result = await parseSHP(file.buffer);
          polygon = result.polygon;
          fileData = result.data;
        }

        if (polygon) {
          const uploadedFile = await storage.createUploadedFile({
            fileName: file.originalname,
            fileType: file.originalname.endsWith(".kml") ? "kml" : "shp",
            fileData,
            polygon,
          });
          
          uploadedFiles.push(uploadedFile);
          polygons.push(polygon);
        }
      }

      res.json({ files: uploadedFiles, polygons });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to process uploaded files" });
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
    const turnRadiusMeters = parameters.turnRadius || (parameters.distance * 0.5);
    
    for (let i = 0; i < transectLines.length; i++) {
      const line = transectLines[i];
      const lineCoords = line.geometry.coordinates;
      const start = lineCoords[0];
      const end = lineCoords[1];
      
      if (i === 0) {
        // First line: add waypoints from start to end
        waypoints.push({ lat: start[1], lng: start[0] });
        waypoints.push({ lat: end[1], lng: end[0] });
      } else {
        // Get previous line info
        const prevLine = transectLines[i - 1];
        const prevStart = prevLine.geometry.coordinates[0];
        const prevEnd = prevLine.geometry.coordinates[1];
        
        // Determine where we ended on the previous line
        const lastWaypoint = waypoints[waypoints.length - 1];
        const endedAtPrevStart = (Math.abs(lastWaypoint.lat - prevStart[1]) < 0.00001 && 
                                  Math.abs(lastWaypoint.lng - prevStart[0]) < 0.00001);
        const fromPoint = endedAtPrevStart ? prevStart : prevEnd;
        
        // Check which end of current line is closer
        const distanceToStart = turf.distance(fromPoint, start);
        const distanceToEnd = turf.distance(fromPoint, end);
        const goingToStart = distanceToStart < distanceToEnd;
        const toPoint = goingToStart ? start : end;
        
        // Calculate bearings for the curve
        const exitBearing = endedAtPrevStart 
          ? turf.bearing(prevEnd, prevStart) // Reverse bearing if we ended at start
          : turf.bearing(prevStart, prevEnd); // Normal bearing if we ended at end
          
        const entryBearing = goingToStart
          ? turf.bearing(start, end) // Normal bearing if entering at start
          : turf.bearing(end, start); // Reverse bearing if entering at end
        
        // Create a simple curved U-turn
        const lateralDistance = turf.distance(fromPoint, toPoint) * 1000; // meters
        const effectiveRadius = Math.min(turnRadiusMeters, lateralDistance * 0.4);
        
        // Extend beyond the line endpoints
        const extensionDistance = effectiveRadius;
        const extendedFrom = turf.destination(fromPoint, extensionDistance, exitBearing, {units: 'meters'});
        const extendedTo = turf.destination(toPoint, extensionDistance, entryBearing + 180, {units: 'meters'});
        
        // Generate curve points
        const numCurvePoints = 15;
        
        // Add extension from line end
        for (let j = 1; j <= 3; j++) {
          const progress = j / 3;
          const pt = turf.along(
            turf.lineString([fromPoint, extendedFrom.geometry.coordinates]),
            progress * extensionDistance,
            {units: 'meters'}
          );
          waypoints.push({ lat: pt.geometry.coordinates[1], lng: pt.geometry.coordinates[0] });
        }
        
        // Create arc between extended points
        for (let j = 1; j < numCurvePoints; j++) {
          const progress = j / numCurvePoints;
          
          // Simple interpolation for the arc
          const arcLng = extendedFrom.geometry.coordinates[0] + 
                        (extendedTo.geometry.coordinates[0] - extendedFrom.geometry.coordinates[0]) * progress;
          const arcLat = extendedFrom.geometry.coordinates[1] + 
                        (extendedTo.geometry.coordinates[1] - extendedFrom.geometry.coordinates[1]) * progress;
          
          // Add outward bulge to create arc
          const midProgress = 1 - Math.abs(2 * progress - 1); // Peak at 0.5
          const bulgeDistance = effectiveRadius * midProgress * 0.5;
          const perpBearing = ((exitBearing + entryBearing) / 2 + 90) % 360;
          
          const bulgePoint = turf.destination([arcLng, arcLat], bulgeDistance, perpBearing, {units: 'meters'});
          waypoints.push({ lat: bulgePoint.geometry.coordinates[1], lng: bulgePoint.geometry.coordinates[0] });
        }
        
        // Add approach to the next line
        for (let j = 3; j >= 1; j--) {
          const progress = j / 3;
          const pt = turf.along(
            turf.lineString([toPoint, extendedTo.geometry.coordinates]),
            progress * extensionDistance,
            {units: 'meters'}
          );
          waypoints.push({ lat: pt.geometry.coordinates[1], lng: pt.geometry.coordinates[0] });
        }
        
        // Add the transect line endpoints
        if (goingToStart) {
          waypoints.push({ lat: start[1], lng: start[0] });
          waypoints.push({ lat: end[1], lng: end[0] });
        } else {
          waypoints.push({ lat: end[1], lng: end[0] });
          waypoints.push({ lat: start[1], lng: start[0] });
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
    };
    
  } catch (error) {
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
    // Navigate KML structure to find coordinates
    const doc = kmlData.kml?.Document?.[0] || kmlData.kml;
    const placemarks = doc?.Placemark || [];
    
    for (const placemark of placemarks) {
      const polygon = placemark.Polygon?.[0];
      if (polygon) {
        const coords = polygon.outerBoundaryIs?.[0]?.LinearRing?.[0]?.coordinates?.[0];
        if (coords) {
          // Parse coordinate string "lng,lat,alt lng,lat,alt ..."
          const coordPairs = coords.trim().split(/\s+/);
          return coordPairs.map((pair: string) => {
            const [lng, lat] = pair.split(',').map(Number);
            return [lng, lat];
          });
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting KML coordinates:", error);
    return null;
  }
};
