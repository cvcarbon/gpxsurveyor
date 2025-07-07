export const generateGPX = (route: any): string => {
  const { waypoints = [], transectLines = [], name = "Transect Route" } = route;
  
  const waypointElements = waypoints.map((waypoint: any, index: number) => `
    <wpt lat="${waypoint.lat}" lon="${waypoint.lng}">
      <name>WP${String(index + 1).padStart(3, '0')}</name>
      <desc>Waypoint ${index + 1}</desc>
      <type>waypoint</type>
    </wpt>
  `).join('');

  // Create track segments from transect lines
  const trackSegments = transectLines.map((line: any, index: number) => {
    const coordinates = line.geometry.coordinates;
    const trackPoints = coordinates.map((coord: number[]) => `
        <trkpt lat="${coord[1]}" lon="${coord[0]}">
          <ele>0</ele>
          <name>Line${index + 1}</name>
        </trkpt>
      `).join('');
    
    return `
      <trkseg>
        <name>Transect Line ${index + 1}</name>
        ${trackPoints}
      </trkseg>`;
  }).join('');

  // Also create a continuous route from waypoints for autopilot navigation
  const routePoints = waypoints.map((waypoint: any, index: number) => `
    <rtept lat="${waypoint.lat}" lon="${waypoint.lng}">
      <name>WP${String(index + 1).padStart(3, '0')}</name>
      <desc>Waypoint ${index + 1}</desc>
    </rtept>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GIS Route Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>Generated autopilot route with transect lines</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  ${waypointElements}
  <rte>
    <name>${name} - Navigation Route</name>
    <desc>Waypoint sequence for autopilot navigation</desc>
    ${routePoints}
  </rte>
  <trk>
    <name>${name} - Transect Lines</name>
    <desc>Survey transect lines</desc>
    ${trackSegments}
  </trk>
</gpx>`;
};

export const generateKML = (route: any): string => {
  const { waypoints = [], transectLines = [], name = "Transect Route" } = route;
  
  // Create waypoint placemarks
  const waypointPlacemarks = waypoints.map((waypoint: any, index: number) => `
    <Placemark>
      <name>WP${String(index + 1).padStart(3, '0')}</name>
      <description>Waypoint ${index + 1}</description>
      <styleUrl>#waypointStyle</styleUrl>
      <Point>
        <coordinates>${waypoint.lng},${waypoint.lat},0</coordinates>
      </Point>
    </Placemark>
  `).join('');

  // Create transect line placemarks
  const linePlacemarks = transectLines.map((line: any, index: number) => {
    const coordinates = line.geometry.coordinates;
    const coordString = coordinates.map((coord: number[]) => `${coord[0]},${coord[1]},0`).join(' ');
    
    return `
    <Placemark>
      <name>Transect Line ${index + 1}</name>
      <description>Survey transect line ${index + 1}</description>
      <styleUrl>#lineStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coordString}</coordinates>
      </LineString>
    </Placemark>`;
  }).join('');

  // Create a continuous path for autopilot navigation
  const navigationPath = waypoints.length > 0 ? `
    <Placemark>
      <name>Navigation Path</name>
      <description>Autopilot navigation path connecting all waypoints</description>
      <styleUrl>#navigationStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${waypoints.map((wp: any) => `${wp.lng},${wp.lat},0`).join(' ')}</coordinates>
      </LineString>
    </Placemark>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>Generated autopilot route with transect lines and navigation path</description>
    
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
