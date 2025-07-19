import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import Sidebar from "@/components/sidebar";
import MapContainer from "@/components/map-container";
import { useToast } from "@/hooks/use-toast";
import { RouteParameters } from "@shared/schema";

export default function RoutePlanner() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [polygon, setPolygon] = useState<any>(null);
  const [routeParameters, setRouteParameters] = useState<RouteParameters>({
    distance: 50,
    bearing: 0,
    overlap: 10,
    turnRadius: 20,
  });
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [arcgisLayers, setArcgisLayers] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const handlePolygonChange = (newPolygon: any) => {
    setPolygon(newPolygon);
    setGeneratedRoute(null); // Clear previous route
  };

  const handleParametersChange = (newParameters: RouteParameters) => {
    setRouteParameters(newParameters);
    setGeneratedRoute(null); // Clear previous route
  };

  const handleRouteGenerated = (route: any) => {
    setGeneratedRoute(route);
    toast({
      title: "Route Generated",
      description: `Successfully generated route with ${route.waypoints?.length || 0} waypoints`,
    });
  };

  const handleError = (error: string) => {
    toast({
      title: "Error",
      description: error,
      variant: "destructive",
    });
  };

  const handleLayerToggle = (layerUrl: string, visible: boolean) => {
    setArcgisLayers(prev => ({
      ...prev,
      [layerUrl]: visible
    }));
  };

  return (
    <>
      <Helmet>
        <title>GPX Surveyor - Autopilot Route Generator</title>
        <meta name="description" content="Generate autopilot survey routes with transect lines and GPX export from uploaded or drawn polygons for Garmin chartplotters and drones." />
      </Helmet>
      
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          polygon={polygon}
          onPolygonChange={handlePolygonChange}
          routeParameters={routeParameters}
          onParametersChange={handleParametersChange}
          generatedRoute={generatedRoute}
          isGenerating={isGenerating}
          onRouteGenerated={handleRouteGenerated}
          onError={handleError}
          onLayerToggle={handleLayerToggle}
          layerVisibility={arcgisLayers}
        />
        
        <div className="flex-1 relative">
          <MapContainer
            polygon={polygon}
            onPolygonChange={handlePolygonChange}
            generatedRoute={generatedRoute}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            arcgisLayers={arcgisLayers}
          />
        </div>
      </div>
    </>
  );
}
