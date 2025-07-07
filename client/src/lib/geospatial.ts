import * as turf from '@turf/turf';

// Geospatial utility functions using Turf.js
export const generateTransectLines = (
  polygon: any,
  distance: number,
  bearing: number,
  overlap: number = 10,
  turnRadius: number = 20
) => {
  try {
    // Ensure polygon is in correct format
    const polygonFeature = polygon.geometry ? polygon : turf.polygon(polygon);
    
    // Get bounding box of the polygon
    const bbox = turf.bbox(polygonFeature);
    const [minX, minY, maxX, maxY] = bbox;
    
    // Calculate effective distance accounting for overlap
    const effectiveDistance = distance * (1 - overlap / 100);
    
    // Generate transect lines
    const transectLines = [];
    const waypoints = [];
    
    // Convert distance from meters to degrees (rough approximation)
    const distanceDegrees = effectiveDistance / 111000; // 1 degree ≈ 111km
    
    // Calculate number of lines needed
    const lineCount = Math.ceil((maxX - minX) / distanceDegrees);
    
    for (let i = 0; i < lineCount; i++) {
      const x = minX + (i * distanceDegrees);
      
      // Create a line that extends beyond the polygon bounds
      const line = turf.lineString([
        [x, minY - 0.01],
        [x, maxY + 0.01]
      ]);
      
      // Rotate the line by the specified bearing
      const center = turf.centroid(polygonFeature);
      const rotatedLine = turf.transformRotate(line, bearing, { pivot: center });
      
      // Find intersections with polygon
      try {
        const intersections = turf.lineIntersect(rotatedLine, polygonFeature);
        
        if (intersections.features.length >= 2) {
          // Create transect line from first to last intersection
          const coords = intersections.features.map(f => f.geometry.coordinates);
          const sortedCoords = coords.sort((a, b) => a[1] - b[1]); // Sort by latitude
          
          const transectLine = turf.lineString([sortedCoords[0], sortedCoords[sortedCoords.length - 1]]);
          transectLines.push(transectLine);
          
          // Add waypoints with alternating direction for back-and-forth pattern
          const lineCoords = transectLine.geometry.coordinates;
          if (i % 2 === 0) {
            // Forward direction
            waypoints.push(
              { lat: lineCoords[0][1], lng: lineCoords[0][0] },
              { lat: lineCoords[1][1], lng: lineCoords[1][0] }
            );
          } else {
            // Reverse direction
            waypoints.push(
              { lat: lineCoords[1][1], lng: lineCoords[1][0] },
              { lat: lineCoords[0][1], lng: lineCoords[0][0] }
            );
          }
        }
      } catch (e) {
        console.warn('Failed to intersect line with polygon:', e);
      }
    }
    
    // Calculate total distance
    let totalDistance = 0;
    for (const line of transectLines) {
      totalDistance += turf.length(line, { units: 'meters' });
    }
    
    // Add turn distances (approximate)
    const turnDistance = (waypoints.length - 1) * turnRadius * Math.PI / 2;
    totalDistance += turnDistance;
    
    // Estimate time (assuming 5 m/s speed)
    const estimatedTime = Math.round(totalDistance / 5 / 60);
    
    return {
      transectLines,
      waypoints,
      totalDistance: Math.round(totalDistance),
      estimatedTime,
    };
  } catch (error) {
    console.error('Error generating transect lines:', error);
    return {
      transectLines: [],
      waypoints: [],
      totalDistance: 0,
      estimatedTime: 0,
    };
  }
};

export const polygonToGeoJSON = (coordinates: number[][]): any => {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    properties: {},
  };
};

export const calculateBounds = (polygon: any) => {
  // Calculate bounding box of polygon
  const coordinates = polygon.geometry.coordinates[0];
  const lats = coordinates.map((coord: number[]) => coord[1]);
  const lngs = coordinates.map((coord: number[]) => coord[0]);
  
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
};

export const estimateTime = (totalDistance: number, speed: number = 5): number => {
  // Estimate time in minutes based on distance (m) and speed (m/s)
  return Math.round(totalDistance / speed / 60);
};
