import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import fs from "fs";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { routeParametersSchema } from "@shared/schema";
import * as turf from "@turf/turf";
import * as xml2js from "xml2js";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/admin-areas", async (_req: Request, res: Response) => {
    try {
      const geoJsonPath = path.resolve(import.meta.dirname, "..", "col_aareas.geojson");
      const fileContents = await fs.promises.readFile(geoJsonPath, "utf-8");
      res.type("application/geo+json").send(fileContents);
    } catch (error) {
      console.error("Failed to load admin areas GeoJSON:", error);
      res.status(500).json({ message: "Failed to load admin areas" });
    }
  });
  
  
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
        } else if (file.mimetype.includes("gpx") || file.originalname.endsWith(".gpx")) {
          console.log("Parsing GPX file");
          const result = await parseGPX(file.buffer);
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
            fileType: file.originalname.endsWith(".kml") ? "kml" : (file.originalname.endsWith(".gpx") ? "gpx" : "shp"),
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
    } catch (error: any) {
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

// ============================================================================
// COORDINATE PROJECTION UTILITIES
// ============================================================================

/**
 * Get UTM zone number from longitude
 */
function getUTMZone(longitude: number): number {
  return Math.floor((longitude + 180) / 6) + 1;
}

/**
 * Project WGS84 (lat/lng) to UTM (meters)
 * Uses simplified UTM projection formulas
 */
function projectToUTM(lng: number, lat: number, zone: number): [number, number] {
  const a = 6378137; // WGS84 semi-major axis
  const f = 1 / 298.257223563; // WGS84 flattening
  const k0 = 0.9996; // UTM scale factor
  const e = Math.sqrt(2 * f - f * f); // eccentricity
  const e2 = e * e;
  const ep2 = e2 / (1 - e2); // e'^2
  
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180; // Central meridian
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ep2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - lng0);
  
  const M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latRad
    - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latRad)
    + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latRad)
    - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latRad));
  
  const x = k0 * N * (A + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A / 120) + 500000;
  
  const y = k0 * (M + N * Math.tan(latRad) * (A * A / 2
    + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A / 720));
  
  return [x, y];
}

/**
 * Project UTM (meters) back to WGS84 (lat/lng)
 */
function projectToWGS84(x: number, y: number, zone: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  
  const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  
  const xAdj = x - 500000;
  const M = y / k0;
  
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));
  
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
    + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);
  
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = ep2 * Math.cos(phi1) * Math.cos(phi1);
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = xAdj / (N1 * k0);
  
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D * D * D * D / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D * D * D * D * D * D / 720);
  
  const lng = lng0 + (D - (1 + 2 * T1 + C1) * D * D * D / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1);
  
  return [lng * 180 / Math.PI, lat * 180 / Math.PI];
}

// ============================================================================
// ROUTE GENERATION ALGORITHM
// ============================================================================

async function generateTransectRoute(polygon: any, parameters: any) {
  try {
    // Convert polygon to Turf.js format
    const polygonFeature = turf.polygon(polygon.geometry.coordinates);
    
    // Get polygon centroid for UTM zone calculation
    const centroid = turf.centroid(polygonFeature);
    const centroidCoords = centroid.geometry.coordinates;
    const utmZone = getUTMZone(centroidCoords[0]);
    
    console.log(`Using UTM Zone ${utmZone} for projection`);
    
    // Project all polygon points to UTM for accurate distance calculations
    const polygonPoints = polygon.geometry.coordinates[0];
    const projectedPoints: [number, number][] = polygonPoints.map((point: number[]) => 
      projectToUTM(point[0], point[1], utmZone)
    );
    
    // Project centroid to UTM
    const centroidUTM = projectToUTM(centroidCoords[0], centroidCoords[1], utmZone);
    
    // Convert bearing to radians and calculate direction vectors (matching Python exactly)
    const bearingRad = (parameters.bearing * Math.PI) / 180;
    const dx = Math.sin(bearingRad);
    const dy = Math.cos(bearingRad);
    const D: [number, number] = [dx, dy]; // Direction vector (along transect lines)
    const P: [number, number] = [dy, -dx]; // Perpendicular vector (across transect spacing)
    
    // Calculate line spacing in meters (accounting for overlap)
    const spacingMeters = parameters.distance * (1 - parameters.overlap / 100);
    
    // Extension distance beyond polygon boundary (in meters) - like Python's extend_dist
    const extendDist = 6.096; // 20 feet in meters, matching Python reference
    
    // Project all polygon points onto the perpendicular axis to find extent
    const perpProjections = projectedPoints.map(point => 
      point[0] * P[0] + point[1] * P[1]
    );
    
    const minProj = Math.min(...perpProjections);
    const maxProj = Math.max(...perpProjections);
    const projectedWidth = maxProj - minProj;
    
    // Calculate number of lines needed
    const lineCount = Math.ceil(projectedWidth / spacingMeters) + 1;
    
    console.log(`Generating ${lineCount} survey lines with ${spacingMeters}m spacing`);
    
    // Calculate maximum dimension for line length (in UTM meters)
    const xCoords = projectedPoints.map(p => p[0]);
    const yCoords = projectedPoints.map(p => p[1]);
    const extentWidth = Math.max(...xCoords) - Math.min(...xCoords);
    const extentHeight = Math.max(...yCoords) - Math.min(...yCoords);
    const maxDim = Math.hypot(extentWidth, extentHeight);
    const lineLength = maxDim * 2;
    
    // Create polygon geometry for clipping (in UTM)
    const projectedPolygonCoords = projectedPoints.map(p => [p[0], p[1]]);
    // Ensure polygon is closed
    if (projectedPolygonCoords[0][0] !== projectedPolygonCoords[projectedPolygonCoords.length - 1][0] ||
        projectedPolygonCoords[0][1] !== projectedPolygonCoords[projectedPolygonCoords.length - 1][1]) {
      projectedPolygonCoords.push([...projectedPolygonCoords[0]]);
    }
    const projectedPolygon = turf.polygon([projectedPolygonCoords]);
    
    // First pass: Generate all transect lines (in UTM coordinates)
    interface SurveyLine {
      start: [number, number];
      end: [number, number];
    }
    const surveyLines: SurveyLine[] = [];
    
    for (let i = 0; i < lineCount; i++) {
      // Calculate offset in perpendicular direction (in meters)
      const offset = minProj + (i * spacingMeters);
      
      // Calculate base point for this line
      const currentProj = centroidUTM[0] * P[0] + centroidUTM[1] * P[1];
      const shift = offset - currentProj;
      const basePoint: [number, number] = [
        centroidUTM[0] + shift * P[0],
        centroidUTM[1] + shift * P[1]
      ];
      
      // Create line extending in both directions along survey bearing
      const halfLen = lineLength / 2;
      const startPoint: [number, number] = [
        basePoint[0] - halfLen * D[0],
        basePoint[1] - halfLen * D[1]
      ];
      const endPoint: [number, number] = [
        basePoint[0] + halfLen * D[0],
        basePoint[1] + halfLen * D[1]
      ];
      
      const line = turf.lineString([startPoint, endPoint]);
      
      // Clip line to polygon using intersection
      try {
        const intersections = turf.lineIntersect(line, projectedPolygon);
        
        if (intersections.features.length >= 2) {
          // Get intersection points and sort along survey direction
          const coords = intersections.features.map(f => f.geometry.coordinates as [number, number]);
          
          // Sort coordinates along the survey direction
          const sortedCoords = coords.sort((a, b) => {
            const projA = a[0] * D[0] + a[1] * D[1];
            const projB = b[0] * D[0] + b[1] * D[1];
            return projA - projB;
          });
          
          // Get first and last intersection points
          const lineStart = sortedCoords[0];
          const lineEnd = sortedCoords[sortedCoords.length - 1];
          
          // Extend the line slightly beyond the polygon (like Python's extend_dist)
          const lineDx = lineEnd[0] - lineStart[0];
          const lineDy = lineEnd[1] - lineStart[1];
          const lineLen = Math.hypot(lineDx, lineDy);
          
          if (lineLen > 0) {
            const dirX = lineDx / lineLen;
            const dirY = lineDy / lineLen;
            
            const extendedStart: [number, number] = [
              lineStart[0] - dirX * extendDist,
              lineStart[1] - dirY * extendDist
            ];
            const extendedEnd: [number, number] = [
              lineEnd[0] + dirX * extendDist,
              lineEnd[1] + dirY * extendDist
            ];
            
            surveyLines.push({
              start: extendedStart,
              end: extendedEnd
            });
          }
        }
      } catch (e) {
        console.warn("Failed to clip line to polygon:", e);
      }
    }
    
    console.log(`Generated ${surveyLines.length} survey lines after clipping`);
    
    // Second pass: Build route with alternating pattern and smooth U-turns
    // Following Python reference exactly for curve generation
    const routePointsUTM: [number, number][] = [];
    
    for (let idx = 0; idx < surveyLines.length; idx++) {
      const line = surveyLines[idx];
      
      // Determine travel direction (alternating pattern)
      let travelStart: [number, number];
      let travelEnd: [number, number];
      
      if (idx % 2 === 0) {
        travelStart = line.start;
        travelEnd = line.end;
      } else {
        travelStart = line.end;
        travelEnd = line.start;
      }
      
      // Add line endpoints to route
      if (idx === 0) {
        // First line: add both start and end
        routePointsUTM.push(travelStart);
        routePointsUTM.push(travelEnd);
      } else {
        // Subsequent lines: only add end (start is connected by curve)
        routePointsUTM.push(travelEnd);
      }
      
      // Generate curved turn to next line (if not the last line)
      if (idx < surveyLines.length - 1) {
        const turnRight = (idx % 2 === 0); // Matches Python: turn_right = (idx % 2 == 0)
        
        const nextLine = surveyLines[idx + 1];
        
        // Determine next line's start point based on alternating pattern
        let nextStart: [number, number];
        if ((idx + 1) % 2 === 0) {
          nextStart = nextLine.start;
        } else {
          nextStart = nextLine.end;
        }
        
        // Following Python exactly:
        // P_end = travel_end
        // P_next = next_start
        // p_end_D = P_end.X * D[0] + P_end.Y * D[1]
        const P_end = travelEnd;
        const P_next = nextStart;
        const p_end_D = P_end[0] * D[0] + P_end[1] * D[1];
        
        // Adjust P_next to align with P_end in the survey direction
        // Python: def adjust_point(P, D, target): current = P.X * D[0] + P.Y * D[1]; shift = target - current; return Point(P.X + shift * D[0], P.Y + shift * D[1])
        const current = P_next[0] * D[0] + P_next[1] * D[1];
        const shift = p_end_D - current;
        const T1 = P_end;
        const T2: [number, number] = [
          P_next[0] + shift * D[0],
          P_next[1] + shift * D[1]
        ];
        
        // Calculate chord distance and radius (Python: R = chord_dist / 2.0)
        const chord_dx = T2[0] - T1[0];
        const chord_dy = T2[1] - T1[1];
        const chord_dist = Math.hypot(chord_dx, chord_dy);
        const R = chord_dist / 2.0;
        
        // Calculate arc center (midpoint of T1 and T2)
        const centerX = (T1[0] + T2[0]) / 2.0;
        const centerY = (T1[1] + T2[1]) / 2.0;
        
        // Calculate start angle
        const start_angle = Math.atan2(T1[1] - centerY, T1[0] - centerX);
        
        // Generate arc points (Python: segments = 12)
        const segments = 12;
        
        if (turnRight) {
          // Python: theta = start_angle - (math.pi * j / segments)
          for (let j = 1; j < segments; j++) {
            const theta = start_angle - (Math.PI * j / segments);
            const x = centerX + R * Math.cos(theta);
            const y = centerY + R * Math.sin(theta);
            routePointsUTM.push([x, y]);
          }
        } else {
          // Python: theta = start_angle + (math.pi * j / segments)
          for (let j = 1; j < segments; j++) {
            const theta = start_angle + (Math.PI * j / segments);
            const x = centerX + R * Math.cos(theta);
            const y = centerY + R * Math.sin(theta);
            routePointsUTM.push([x, y]);
          }
        }
        
        // Add the aligned T2 point (connects to next line)
        routePointsUTM.push(T2);
      }
    }
    
    console.log(`Generated ${routePointsUTM.length} route points`);
    
    // Convert route points back to WGS84
    const waypoints = routePointsUTM.map(point => {
      const [lng, lat] = projectToWGS84(point[0], point[1], utmZone);
      return { lat, lng };
    });
    
    // Convert survey lines to GeoJSON for display (in WGS84)
    const transectLines = surveyLines.map(line => {
      const startWGS = projectToWGS84(line.start[0], line.start[1], utmZone);
      const endWGS = projectToWGS84(line.end[0], line.end[1], utmZone);
      return turf.lineString([startWGS, endWGS]);
    });
    
    // Calculate total distance (in meters)
    let totalDistance = 0;
    
    // Add transect line distances
    for (const line of surveyLines) {
      const dx = line.end[0] - line.start[0];
      const dy = line.end[1] - line.start[1];
      totalDistance += Math.hypot(dx, dy);
    }
    
    // Add turn distances (approximate arc lengths)
    // Each turn is a semicircle with radius = spacing / 2
    const turnRadius = spacingMeters / 2;
    const turnArcLength = Math.PI * turnRadius; // Half circle
    totalDistance += (surveyLines.length - 1) * turnArcLength;
    
    // Estimate time (assuming 5 m/s average speed)
    const estimatedTime = Math.round(totalDistance / 5 / 60);
    
    console.log(`Total distance: ${Math.round(totalDistance)}m, Estimated time: ${estimatedTime} minutes`);
    
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

// ============================================================================
// FILE PARSING UTILITIES
// ============================================================================

const parseGPX = async (buffer: Buffer): Promise<{ polygon: any; data: any }> => {
  const parser = new xml2js.Parser();
  
  try {
    const result = await parser.parseStringPromise(buffer.toString());
    
    // Extract coordinates from GPX
    const coordinates = extractGPXCoordinates(result);
    
    if (coordinates && coordinates.length >= 3) {
      // Ensure polygon is closed
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push([...coordinates[0]]);
      }
      
      const polygon = turf.polygon([coordinates]);
      return { polygon: polygon, data: result };
    }
    
    throw new Error("No valid polygon found in GPX");
  } catch (error) {
    throw new Error("Failed to parse GPX file");
  }
};

const extractGPXCoordinates = (gpxData: any): number[][] | null => {
  try {
    console.log("Extracting GPX coordinates");
    const gpx = gpxData.gpx;
    if (!gpx) return null;

    let points: any[] = [];

    // Try tracks (<trk>)
    if (gpx.trk) {
      for (const trk of gpx.trk) {
        if (trk.trkseg) {
          for (const seg of trk.trkseg) {
            if (seg.trkpt) {
              points = points.concat(seg.trkpt);
            }
          }
        }
      }
    }
    
    // If no tracks, try routes (<rte>)
    if (points.length === 0 && gpx.rte) {
      for (const rte of gpx.rte) {
        if (rte.rtept) {
          points = points.concat(rte.rtept);
        }
      }
    }

    // If no routes, try waypoints (<wpt>) - effectively a convex hull of points
    if (points.length === 0 && gpx.wpt) {
      points = gpx.wpt;
    }

    if (points.length === 0) {
      console.log("No points found in GPX");
      return null;
    }

    console.log(`Found ${points.length} points in GPX`);

    return points.map((pt: any) => {
      // Attributes are usually in $, e.g. <trkpt lat="..." lon="...">
      const lat = parseFloat(pt.$.lat);
      const lon = parseFloat(pt.$.lon);
      return [lon, lat];
    });

  } catch (error) {
    console.error("Error extracting GPX coordinates:", error);
    return null;
  }
};

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
