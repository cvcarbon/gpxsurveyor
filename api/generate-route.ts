import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as turf from '@turf/turf';
import { z } from 'zod';

const routeParametersSchema = z.object({
  distance: z.number().min(1).max(1000),
  bearing: z.number().min(0).max(360),
  overlap: z.number().min(0).max(50).optional().default(10),
  turnRadius: z.number().min(1).max(100).optional().default(20),
});

// ============================================================================
// COORDINATE PROJECTION UTILITIES
// ============================================================================

function getUTMZone(longitude: number): number {
  return Math.floor((longitude + 180) / 6) + 1;
}

function projectToUTM(lng: number, lat: number, zone: number): [number, number] {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = e * e;
  const ep2 = e2 / (1 - e2);
  
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  const lng0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  
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
// ROUTE GENERATION
// ============================================================================

async function generateTransectRoute(polygon: any, parameters: any) {
  const polygonFeature = turf.polygon(polygon.geometry.coordinates);
  const centroid = turf.centroid(polygonFeature);
  const centroidCoords = centroid.geometry.coordinates;
  const utmZone = getUTMZone(centroidCoords[0]);
  
  const polygonPoints = polygon.geometry.coordinates[0];
  const projectedPoints: [number, number][] = polygonPoints.map((point: number[]) => 
    projectToUTM(point[0], point[1], utmZone)
  );
  
  const centroidUTM = projectToUTM(centroidCoords[0], centroidCoords[1], utmZone);
  
  const bearingRad = (parameters.bearing * Math.PI) / 180;
  const dx = Math.sin(bearingRad);
  const dy = Math.cos(bearingRad);
  const D: [number, number] = [dx, dy];
  const P: [number, number] = [dy, -dx];
  
  const spacingMeters = parameters.distance * (1 - parameters.overlap / 100);
  const extendDist = 6.096;
  
  const perpProjections = projectedPoints.map(point => 
    point[0] * P[0] + point[1] * P[1]
  );
  
  const minProj = Math.min(...perpProjections);
  const maxProj = Math.max(...perpProjections);
  const projectedWidth = maxProj - minProj;
  const lineCount = Math.ceil(projectedWidth / spacingMeters) + 1;
  
  const xCoords = projectedPoints.map(p => p[0]);
  const yCoords = projectedPoints.map(p => p[1]);
  const extentWidth = Math.max(...xCoords) - Math.min(...xCoords);
  const extentHeight = Math.max(...yCoords) - Math.min(...yCoords);
  const maxDim = Math.hypot(extentWidth, extentHeight);
  const lineLength = maxDim * 2;
  
  const projectedPolygonCoords = projectedPoints.map(p => [p[0], p[1]]);
  if (projectedPolygonCoords[0][0] !== projectedPolygonCoords[projectedPolygonCoords.length - 1][0] ||
      projectedPolygonCoords[0][1] !== projectedPolygonCoords[projectedPolygonCoords.length - 1][1]) {
    projectedPolygonCoords.push([...projectedPolygonCoords[0]]);
  }
  const projectedPolygon = turf.polygon([projectedPolygonCoords]);
  
  interface SurveyLine {
    start: [number, number];
    end: [number, number];
  }
  const surveyLines: SurveyLine[] = [];
  
  for (let i = 0; i < lineCount; i++) {
    const offset = minProj + (i * spacingMeters);
    const currentProj = centroidUTM[0] * P[0] + centroidUTM[1] * P[1];
    const shift = offset - currentProj;
    const basePoint: [number, number] = [
      centroidUTM[0] + shift * P[0],
      centroidUTM[1] + shift * P[1]
    ];
    
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
    
    try {
      const intersections = turf.lineIntersect(line, projectedPolygon);
      
      if (intersections.features.length >= 2) {
        const coords = intersections.features.map(f => f.geometry.coordinates as [number, number]);
        const sortedCoords = coords.sort((a, b) => {
          const projA = a[0] * D[0] + a[1] * D[1];
          const projB = b[0] * D[0] + b[1] * D[1];
          return projA - projB;
        });
        
        const lineStart = sortedCoords[0];
        const lineEnd = sortedCoords[sortedCoords.length - 1];
        
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
          
          surveyLines.push({ start: extendedStart, end: extendedEnd });
        }
      }
    } catch (e) {
      console.warn("Failed to clip line to polygon:", e);
    }
  }
  
  const routePointsUTM: [number, number][] = [];
  
  for (let idx = 0; idx < surveyLines.length; idx++) {
    const line = surveyLines[idx];
    
    let travelStart: [number, number];
    let travelEnd: [number, number];
    
    if (idx % 2 === 0) {
      travelStart = line.start;
      travelEnd = line.end;
    } else {
      travelStart = line.end;
      travelEnd = line.start;
    }
    
    if (idx === 0) {
      routePointsUTM.push(travelStart);
      routePointsUTM.push(travelEnd);
    } else {
      routePointsUTM.push(travelEnd);
    }
    
    if (idx < surveyLines.length - 1) {
      const turnRight = (idx % 2 === 0);
      const nextLine = surveyLines[idx + 1];
      
      let nextStart: [number, number];
      if ((idx + 1) % 2 === 0) {
        nextStart = nextLine.start;
      } else {
        nextStart = nextLine.end;
      }
      
      const P_end = travelEnd;
      const P_next = nextStart;
      const p_end_D = P_end[0] * D[0] + P_end[1] * D[1];
      
      const current = P_next[0] * D[0] + P_next[1] * D[1];
      const shiftVal = p_end_D - current;
      const T1 = P_end;
      const T2: [number, number] = [
        P_next[0] + shiftVal * D[0],
        P_next[1] + shiftVal * D[1]
      ];
      
      const chord_dx = T2[0] - T1[0];
      const chord_dy = T2[1] - T1[1];
      const chord_dist = Math.hypot(chord_dx, chord_dy);
      const R = chord_dist / 2.0;
      
      const centerX = (T1[0] + T2[0]) / 2.0;
      const centerY = (T1[1] + T2[1]) / 2.0;
      
      const start_angle = Math.atan2(T1[1] - centerY, T1[0] - centerX);
      const segments = 12;
      
      if (turnRight) {
        for (let j = 1; j < segments; j++) {
          const theta = start_angle - (Math.PI * j / segments);
          const x = centerX + R * Math.cos(theta);
          const y = centerY + R * Math.sin(theta);
          routePointsUTM.push([x, y]);
        }
      } else {
        for (let j = 1; j < segments; j++) {
          const theta = start_angle + (Math.PI * j / segments);
          const x = centerX + R * Math.cos(theta);
          const y = centerY + R * Math.sin(theta);
          routePointsUTM.push([x, y]);
        }
      }
      
      routePointsUTM.push(T2);
    }
  }
  
  const waypoints = routePointsUTM.map(point => {
    const [lng, lat] = projectToWGS84(point[0], point[1], utmZone);
    return { lat, lng };
  });
  
  const transectLines = surveyLines.map(line => {
    const startWGS = projectToWGS84(line.start[0], line.start[1], utmZone);
    const endWGS = projectToWGS84(line.end[0], line.end[1], utmZone);
    return turf.lineString([startWGS, endWGS]);
  });
  
  let totalDistance = 0;
  for (const line of surveyLines) {
    const lineDx = line.end[0] - line.start[0];
    const lineDy = line.end[1] - line.start[1];
    totalDistance += Math.hypot(lineDx, lineDy);
  }
  
  const turnRadius = spacingMeters / 2;
  const turnArcLength = Math.PI * turnRadius;
  totalDistance += (surveyLines.length - 1) * turnArcLength;
  
  const estimatedTime = Math.round(totalDistance / 5 / 60);
  
  return {
    transectLines,
    waypoints,
    totalDistance: Math.round(totalDistance),
    estimatedTime,
    bearing: parameters.bearing,
    distance: parameters.distance,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { polygon, parameters, name } = req.body;
    
    if (!polygon || !parameters) {
      return res.status(400).json({ message: 'Polygon and parameters required' });
    }

    const validParams = routeParametersSchema.parse(parameters);
    const route = await generateTransectRoute(polygon, validParams);
    const routeName = name?.trim() || `Route ${Date.now()}`;

    return res.status(200).json({
      id: Date.now(),
      name: routeName,
      polygon,
      ...route,
    });
  } catch (error) {
    console.error('Route generation error:', error);
    return res.status(500).json({ message: 'Failed to generate route' });
  }
}

