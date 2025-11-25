import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as turf from '@turf/turf';

// Simple XML parser for KML
function parseKMLString(xmlString: string): any {
  // Extract coordinates from KML using regex (simplified parser)
  const coordinatesMatch = xmlString.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i);
  
  if (!coordinatesMatch) {
    throw new Error('No coordinates found in KML');
  }
  
  const coordString = coordinatesMatch[1].trim();
  const coordPairs = coordString.split(/[\s\n]+/).filter(pair => pair.trim().length > 0);
  
  const coordinates = coordPairs.map(pair => {
    const [lng, lat] = pair.split(',').map(Number);
    return [lng, lat];
  }).filter(coord => !isNaN(coord[0]) && !isNaN(coord[1]));
  
  if (coordinates.length < 3) {
    throw new Error('Not enough coordinates for a polygon');
  }
  
  // Ensure polygon is closed
  if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
      coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
    coordinates.push([...coordinates[0]]);
  }
  
  return turf.polygon([coordinates]);
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
    // For Vercel, we need to handle the file differently
    // The client should send the file content as base64 or text
    const { fileContent, fileName, fileType } = req.body;
    
    if (!fileContent) {
      return res.status(400).json({ message: 'No file content provided' });
    }

    let polygon = null;

    if (fileType === 'kml' || fileName?.endsWith('.kml')) {
      // Decode base64 if needed
      const content = fileContent.startsWith('data:') 
        ? Buffer.from(fileContent.split(',')[1], 'base64').toString('utf-8')
        : fileContent;
      
      polygon = parseKMLString(content);
    } else {
      return res.status(400).json({ message: 'Unsupported file type. Only KML files are supported.' });
    }

    if (!polygon) {
      return res.status(400).json({ message: 'Could not extract polygon from file' });
    }

    return res.status(200).json({
      files: [{
        id: Date.now(),
        fileName: fileName || 'uploaded.kml',
        fileType: 'kml',
      }],
      polygons: [polygon],
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return res.status(500).json({ 
      message: 'Failed to process uploaded file', 
      error: error.message 
    });
  }
}

