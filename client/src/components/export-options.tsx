import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateGPX, generateKML } from "@/lib/gpx-builder";

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
      
      // Generate filename using route name, bearing, and distance
      const routeName = generatedRoute.name || "Survey Route";
      const bearing = generatedRoute.bearing || 0;
      const distance = generatedRoute.distance || 50;
      const filename = `${routeName}_${bearing}d_${distance}m.gpx`;
      
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
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
      // Export KML with transect lines and navigation path
      const kmlContent = generateKML(generatedRoute);
      const blob = new Blob([kmlContent], { type: "application/vnd.google-earth.kml+xml" });
      const url = URL.createObjectURL(blob);
      
      // Generate filename using route name, bearing, and distance
      const routeName = generatedRoute.name || "Survey Route";
      const bearing = generatedRoute.bearing || 0;
      const distance = generatedRoute.distance || 50;
      const filename = `${routeName}_${bearing}d_${distance}m.kml`;
      
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      onError("Failed to export KML file");
    }
  };

  return (
    <Card className="border-0 border-t border-gray-100 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Export Route</CardTitle>
        {!hasRoute && (
          <p className="text-sm text-gray-500">Generate a route first to enable export options</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={handleExportGPX}
          disabled={!hasRoute}
          className={`w-full ${hasRoute ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-100 text-gray-400'}`}
        >
          <Download className="h-4 w-4 mr-2" />
          Export as GPX
        </Button>

        <Button
          onClick={handleExportKML}
          disabled={!hasRoute}
          variant="outline"
          className={`w-full ${!hasRoute ? 'text-gray-400 border-gray-200' : ''}`}
        >
          <Download className="h-4 w-4 mr-2" />
          Export as KML
        </Button>
      </CardContent>
    </Card>
  );
}
