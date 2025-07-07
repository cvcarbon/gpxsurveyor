import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Share, Save } from "lucide-react";
import { generateGPX } from "@/lib/gpx-builder";

interface ExportOptionsProps {
  generatedRoute: any;
  onError: (error: string) => void;
}

export default function ExportOptions({
  generatedRoute,
  onError,
}: ExportOptionsProps) {
  const hasRoute = generatedRoute && generatedRoute.waypoints;

  const handleExportGPX = () => {
    if (!hasRoute) {
      onError("No route to export");
      return;
    }

    try {
      const gpxContent = generateGPX(generatedRoute);
      const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `transect-route-${Date.now()}.gpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      onError("Failed to export GPX file");
    }
  };

  const handleExportKML = () => {
    if (!hasRoute) {
      onError("No route to export");
      return;
    }

    try {
      // Simple KML export
      const kmlContent = generateKML(generatedRoute);
      const blob = new Blob([kmlContent], { type: "application/vnd.google-earth.kml+xml" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `transect-route-${Date.now()}.kml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      onError("Failed to export KML file");
    }
  };

  const generateKML = (route: any) => {
    const waypoints = route.waypoints || [];
    const placemarks = waypoints.map((waypoint: any, index: number) => `
      <Placemark>
        <name>Waypoint ${index + 1}</name>
        <Point>
          <coordinates>${waypoint.lng},${waypoint.lat},0</coordinates>
        </Point>
      </Placemark>
    `).join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Transect Route</name>
    <description>Generated autopilot route</description>
    ${placemarks}
  </Document>
</kml>`;
  };

  return (
    <Card className="border-0 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Export Route</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={handleExportGPX}
          disabled={!hasRoute}
          className="w-full bg-success hover:bg-success/90"
        >
          <Download className="h-4 w-4 mr-2" />
          Export as GPX
        </Button>

        <Button
          onClick={handleExportKML}
          disabled={!hasRoute}
          variant="outline"
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Export as KML
        </Button>

        <div className="flex space-x-2">
          <Button
            disabled={!hasRoute}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Share className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button
            disabled={!hasRoute}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
