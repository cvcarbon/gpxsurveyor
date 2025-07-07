export const generateGPX = (route: any): string => {
  const { waypoints = [], transectLines = [], name = "Transect Route" } = route;
  
  // Create a single track segment with all waypoints (includes curves and lines)
  // This creates a continuous path for the autopilot to follow
  const trackPoints = waypoints.map((waypoint: any) => {
    return `      <trkpt lon="${waypoint.lng}" lat="${waypoint.lat}">
        <ele>0</ele>
      </trkpt>`;
  }).join('\n');
  
  const trackSegment = `    <trkseg>
${trackPoints}
    </trkseg>`;

  // Create a single track with the continuous path
  return `<?xml version="1.0" ?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xalan="http://xml.apache.org/xalan" xsi="http://www.w3.org/2001/XMLSchema-instance" creator="GIS Route Planner" version="1.1">
  <trk>
    <name>${name}</name>
    <desc>1</desc>
${trackSegment}
  </trk>
</gpx>`;
};

export const generateKML = (route: any): string => {
  const { waypoints = [], transectLines = [], name = "Transect Route" } = route;
  
  // Escape XML special characters for KML
  const escapeXml = (text: string) => {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
  };

  const safeName = escapeXml(name);
  const safeDesc = escapeXml(`Generated autopilot route with transect lines - ${new Date().toLocaleDateString()}`);
  
  // Create waypoint placemarks
  const waypointPlacemarks = waypoints.map((waypoint: any, index: number) => {
    const wpName = `WP${String(index + 1).padStart(3, '0')}`;
    const wpDesc = `Waypoint ${index + 1} - Survey Point`;
    
    return `    <Placemark>
      <name>${escapeXml(wpName)}</name>
      <description>${escapeXml(wpDesc)}</description>
      <styleUrl>#waypointStyle</styleUrl>
      <Point>
        <coordinates>${waypoint.lng.toFixed(8)},${waypoint.lat.toFixed(8)},0</coordinates>
      </Point>
    </Placemark>`;
  }).join('\n');

  // Create transect line placemarks
  const linePlacemarks = transectLines.map((line: any, index: number) => {
    const coordinates = line.geometry.coordinates;
    const coordString = coordinates.map((coord: number[]) => `${coord[0].toFixed(8)},${coord[1].toFixed(8)},0`).join(' ');
    const lineName = `Transect Line ${index + 1}`;
    const lineDesc = `Survey transect line ${index + 1}`;
    
    return `    <Placemark>
      <name>${escapeXml(lineName)}</name>
      <description>${escapeXml(lineDesc)}</description>
      <styleUrl>#lineStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordString}</coordinates>
      </LineString>
    </Placemark>`;
  }).join('\n');

  // Create a continuous path for autopilot navigation
  const navigationPath = waypoints.length > 0 ? `    <Placemark>
      <name>${escapeXml('Navigation Path')}</name>
      <description>${escapeXml('Autopilot navigation path connecting all waypoints')}</description>
      <styleUrl>#navigationStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${waypoints.map((wp: any) => `${wp.lng.toFixed(8)},${wp.lat.toFixed(8)},0`).join(' ')}</coordinates>
      </LineString>
    </Placemark>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${safeName}</name>
    <description>${safeDesc}</description>
    
    <!-- Styles -->
    <Style id="waypointStyle">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Style id="lineStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
    </Style>
    
    <Style id="navigationStyle">
      <LineStyle>
        <color>ff00ff00</color>
        <width>2</width>
      </LineStyle>
    </Style>
    
${waypointPlacemarks}
${linePlacemarks}
${navigationPath}
  </Document>
</kml>`;
};
