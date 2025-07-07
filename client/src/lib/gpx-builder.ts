export const generateGPX = (route: any): string => {
  const { waypoints = [], name = "Transect Route" } = route;
  
  const waypointElements = waypoints.map((waypoint: any, index: number) => `
    <wpt lat="${waypoint.lat}" lon="${waypoint.lng}">
      <name>WP${String(index + 1).padStart(3, '0')}</name>
      <desc>Waypoint ${index + 1}</desc>
      <type>waypoint</type>
    </wpt>
  `).join('');

  const trackPoints = waypoints.map((waypoint: any) => `
      <trkpt lat="${waypoint.lat}" lon="${waypoint.lng}">
        <ele>0</ele>
      </trkpt>
    `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GIS Route Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>Generated autopilot route with transect lines</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  ${waypointElements}
  <trk>
    <name>${name}</name>
    <desc>Transect route track</desc>
    <trkseg>
      ${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
};

export const generateKML = (route: any): string => {
  const { waypoints = [], name = "Transect Route" } = route;
  
  const placemarks = waypoints.map((waypoint: any, index: number) => `
    <Placemark>
      <name>WP${String(index + 1).padStart(3, '0')}</name>
      <description>Waypoint ${index + 1}</description>
      <Point>
        <coordinates>${waypoint.lng},${waypoint.lat},0</coordinates>
      </Point>
    </Placemark>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>Generated autopilot route</description>
    ${placemarks}
  </Document>
</kml>`;
};
