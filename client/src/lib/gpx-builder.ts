export const generateGPX = (route: any): string => {
  const { waypoints = [], transectLines = [], name = "Transect Route" } = route;
  
  // Escape XML special characters
  const escapeXml = (text: string) => {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
  };

  const safeName = escapeXml(name);
  const safeDesc = escapeXml(`Generated autopilot route with transect lines - ${new Date().toLocaleDateString()}`);
  
  const waypointElements = waypoints.map((waypoint: any, index: number) => {
    const wpName = `WP${String(index + 1).padStart(3, '0')}`;
    const wpDesc = `Waypoint ${index + 1} - Survey Point`;
    
    return `  <wpt lat="${waypoint.lat.toFixed(8)}" lon="${waypoint.lng.toFixed(8)}">
    <name>${escapeXml(wpName)}</name>
    <desc>${escapeXml(wpDesc)}</desc>
    <type>waypoint</type>
    <sym>Flag, Blue</sym>
  </wpt>`;
  }).join('\n');

  // Create track segments from transect lines - each line as separate segment
  const trackSegments = transectLines.map((line: any, index: number) => {
    const coordinates = line.geometry.coordinates;
    const trackPoints = coordinates.map((coord: number[]) => {
      return `      <trkpt lat="${coord[1].toFixed(8)}" lon="${coord[0].toFixed(8)}">
        <ele>0</ele>
      </trkpt>`;
    }).join('\n');
    
    return `    <trkseg>
${trackPoints}
    </trkseg>`;
  }).join('\n');

  // Create navigation route from waypoints
  const routePoints = waypoints.map((waypoint: any, index: number) => {
    const wpName = `WP${String(index + 1).padStart(3, '0')}`;
    const wpDesc = `Navigation point ${index + 1}`;
    
    return `    <rtept lat="${waypoint.lat.toFixed(8)}" lon="${waypoint.lng.toFixed(8)}">
      <name>${escapeXml(wpName)}</name>
      <desc>${escapeXml(wpDesc)}</desc>
    </rtept>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GIS Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    <desc>${safeDesc}</desc>
    <time>${new Date().toISOString()}</time>
    <keywords>survey,transect,autopilot,navigation</keywords>
  </metadata>
${waypointElements}
  <rte>
    <name>${escapeXml(safeName + ' - Navigation Route')}</name>
    <desc>${escapeXml('Waypoint sequence for autopilot navigation')}</desc>
${routePoints}
  </rte>
  <trk>
    <name>${escapeXml(safeName + ' - Survey Lines')}</name>
    <desc>${escapeXml('Survey transect lines for data collection')}</desc>
    <type>track</type>
${trackSegments}
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
