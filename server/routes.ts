import express, { Request, Response } from "express";
import multer from "multer";
import xml2js from "xml2js";
import * as turf from "@turf/turf";
import { storage } from "./storage.js";

const router = express.Router();
const upload = multer();

// Test endpoint
router.get("/api/test", (req: Request, res: Response) => {
  res.json({ message: "API is working!" });
});

// Get all routes  
router.get("/api/routes", async (req: Request, res: Response) => {
  try {
    // For simplicity, return empty array since we don't have a getRoutes method
    res.json([]);
  } catch (error) {
    console.error("Error fetching routes:", error);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});

// Get specific route
router.get("/api/routes/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const route = await storage.getRoute(id);
    
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }
    
    res.json(route);
  } catch (error) {
    console.error("Error fetching route:", error);
    res.status(500).json({ error: "Failed to fetch route" });
  }
});

// Generate route from polygon
router.post("/api/generate-route", async (req: Request, res: Response) => {
  try {
    const { name, polygon, parameters } = req.body;
    console.log("Starting route generation with:");
    console.log("Polygon:", JSON.stringify(polygon, null, 2));
    console.log("Parameters:", JSON.stringify(parameters, null, 2));

    if (!polygon || !parameters) {
      return res.status(400).json({ error: "Missing polygon or parameters" });
    }

    // Generate route
    const routeData = generateTransectRoute(polygon, parameters);
    
    // Store route
    const route = await storage.createRoute({
      name: name || "Survey Route",
      polygon,
      distance: parameters.distance,
      bearing: parameters.bearing,
      overlap: parameters.overlap,
      turnRadius: parameters.turnRadius,
      transectLines: routeData.transectLines,
      waypoints: routeData.waypoints,
      totalDistance: routeData.totalDistance,
      estimatedTime: routeData.estimatedTime,
    });

    res.json(route);
  } catch (error) {
    console.error("Error generating route:", error);
    console.error("Stack trace:", error.stack);
    res.status(500).json({ error: `Failed to generate route: ${error.message}` });
  }
});

// Upload and parse KML/SHP file
router.post("/api/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileType = req.file.originalname.toLowerCase().endsWith('.kml') ? 'kml' : 'shp';
    let parsedData;

    if (fileType === 'kml') {
      parsedData = await parseKML(req.file.buffer);
    } else {
      parsedData = await parseSHP(req.file.buffer);
    }

    // Store file
    const file = await storage.createUploadedFile({
      fileName: req.file.originalname,
      fileType,
      fileData: parsedData.data,
      polygon: parsedData.polygon
    });

    res.json({
      id: file.id,
      fileName: file.fileName,
      fileType: file.fileType,
      polygon: parsedData.polygon
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: `Failed to upload file: ${error.message}` });
  }
});

// Generate transect route from polygon and parameters
function generateTransectRoute(polygon: any, parameters: any) {
  try {
    console.log("Processing polygon type:", polygon.type);
    
    // Create polygon from coordinates
    let polygonFeature;
    if (polygon.type === "Polygon") {
      console.log("Creating polygon from coordinates");
      
      // Check if coordinates are in Web Mercator (large numbers)
      const firstCoord = polygon.coordinates[0][0];
      if (Math.abs(firstCoord[0]) > 360 || Math.abs(firstCoord[1]) > 180) {
        console.log("Converting from Web Mercator to WGS84");
        // Convert Web Mercator to WGS84
        const convertedCoords = polygon.coordinates[0].map(coord => {
          const x = coord[0];
          const y = coord[1];
          const lng = (x / 20037508.34) * 180;
          let lat = (y / 20037508.34) * 180;
          lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
          return [lng, lat];
        });
        console.log("Converted coordinates:", convertedCoords);
        polygonFeature = turf.polygon([convertedCoords]);
      } else {
        polygonFeature = turf.polygon(polygon.coordinates);
      }
    } else if (polygon.type === "Feature" && polygon.geometry.type === "Polygon") {
      polygonFeature = polygon;
    } else {
      throw new Error(`Unsupported polygon type: ${polygon.type}`);
    }
    
    console.log("Polygon feature created successfully");
    
    // Calculate polygon dimensions
    const bbox = turf.bbox(polygonFeature);
    const diagonal = Math.sqrt(
      Math.pow(bbox[2] - bbox[0], 2) + Math.pow(bbox[3] - bbox[1], 2)
    );
    
    // Calculate effective distance accounting for overlap
    const overlapFactor = (100 - parameters.overlap) / 100;
    const effectiveDistance = parameters.distance * overlapFactor;
    
    // Calculate number of lines needed
    const perpBearing = (parameters.bearing + 90) % 360;
    const perpBearingRad = (perpBearing * Math.PI) / 180;
    const lineCount = Math.ceil((diagonal * 111000) / effectiveDistance);
    
    console.log(`Generating ${lineCount} transect lines with ${effectiveDistance}m spacing`);
    
    // Get polygon center for line generation
    const center = turf.center(polygonFeature).geometry.coordinates;
    
    // Generate parallel lines
    const transectLines = [];
    const waypoints = [];
    
    // Calculate bearing in radians (needed for waypoint generation later)
    const bearingRad = (parameters.bearing * Math.PI) / 180;
    
    for (let i = 0; i < lineCount; i++) {
      // Calculate offset from center along perpendicular bearing
      const offset = (i - lineCount / 2) * (effectiveDistance / 111000);
      
      // Calculate line start point by moving along perpendicular bearing
      const offsetX = offset * Math.cos(perpBearingRad);
      const offsetY = offset * Math.sin(perpBearingRad);
      const lineCenter = [center[0] + offsetX, center[1] + offsetY];
      
      // Create a long line along the bearing direction
      const lineLength = diagonal * 2; // Make it long enough to span the polygon
      const lineLengthDegrees = lineLength;
      
      const startX = lineCenter[0] - lineLengthDegrees * Math.cos(bearingRad);
      const startY = lineCenter[1] - lineLengthDegrees * Math.sin(bearingRad);
      const endX = lineCenter[0] + lineLengthDegrees * Math.cos(bearingRad);
      const endY = lineCenter[1] + lineLengthDegrees * Math.sin(bearingRad);
      
      const line = turf.lineString([
        [startX, startY],
        [endX, endY]
      ]);
      
      // Find intersections with polygon
      try {
        const intersections = turf.lineIntersect(line, polygonFeature);
        
        if (intersections.features.length >= 2) {
          // Sort intersection points along the line direction
          const coords = intersections.features.map(f => f.geometry.coordinates);
          coords.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a[0] - startX, 2) + Math.pow(a[1] - startY, 2));
            const distB = Math.sqrt(Math.pow(b[0] - startX, 2) + Math.pow(b[1] - startY, 2));
            return distA - distB;
          });
          
          // Create transect line from first to last intersection
          const transectLine = turf.lineString([coords[0], coords[coords.length - 1]]);
          transectLines.push(transectLine);
        }
      } catch (e) {
        console.warn("Failed to intersect line with polygon:", e);
      }
    }

    // Create simple waypoint path with alternating directions
    console.log(`Creating waypoints for ${transectLines.length} transect lines`);
    
    for (let i = 0; i < transectLines.length; i++) {
      const line = transectLines[i];
      const coords = line.geometry.coordinates;
      
      // Determine direction based on alternating pattern
      if (i % 2 === 0) {
        // Even lines: start to end
        waypoints.push({ lat: coords[0][1], lng: coords[0][0] });
        waypoints.push({ lat: coords[1][1], lng: coords[1][0] });
      } else {
        // Odd lines: end to start (back-and-forth pattern)
        waypoints.push({ lat: coords[1][1], lng: coords[1][0] });
        waypoints.push({ lat: coords[0][1], lng: coords[0][0] });
      }
    }
    
    // Calculate total distance
    let totalDistance = 0;
    for (const line of transectLines) {
      totalDistance += turf.length(line, { units: "meters" });
    }
    
    // Add turn distances
    const turnDistance = (transectLines.length - 1) * parameters.turnRadius * Math.PI / 2;
    totalDistance += turnDistance;
    
    // Estimate time (assuming 5 m/s average speed)
    const estimatedTime = Math.round(totalDistance / 5 / 60);
    
    console.log(`Route generation completed: ${transectLines.length} lines, ${waypoints.length} waypoints`);
    
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
    
    for (const placemark of placemarks) {
      const geometry = placemark?.Polygon?.[0] || placemark?.LineString?.[0];
      if (geometry) {
        const coordinateString = geometry?.outerBoundaryIs?.[0]?.LinearRing?.[0]?.coordinates?.[0] ||
                               geometry?.coordinates?.[0];
        
        if (coordinateString) {
          const coords = coordinateString.trim().split(/\s+/).map((coord: string) => {
            const parts = coord.split(',');
            return [parseFloat(parts[0]), parseFloat(parts[1])];
          });
          
          // Ensure polygon is closed
          if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
            coords.push(coords[0]);
          }
          
          return coords;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting KML coordinates:", error);
    return null;
  }
};

export const registerRoutes = (app: express.Express) => {
  app.use("/", router);
  return app;
};

export default router;