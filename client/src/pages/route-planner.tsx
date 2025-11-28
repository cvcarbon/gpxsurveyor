import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import Sidebar from "@/components/sidebar";
import MapContainer from "@/components/map-container";
import { useToast } from "@/hooks/use-toast";
import { RouteParameters } from "@shared/schema";
import { useArcGISAuth, LEASE_LAYER_ADMIN, LEASE_LAYER_PUBLIC } from "@/lib/arcgis-auth";

export default function RoutePlanner() {
  const [sidebarOpen, setSidebarOpen] = useState(true); // Start open, will be responsive
  const [userToggled, setUserToggled] = useState(false); // Track if user manually toggled
  const [polygon, setPolygon] = useState<any>(null);
  const [routeParameters, setRouteParameters] = useState<RouteParameters>({
    distance: 50,
    bearing: 0,
    overlap: 10,
    turnRadius: 20,
  });
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { isAdmin, isAuthenticated, isLoading } = useArcGISAuth();
  
  // Always show the lease layer - use admin layer if authenticated with admin access
  const leaseLayerUrl = isAdmin ? LEASE_LAYER_ADMIN : LEASE_LAYER_PUBLIC;
  const [arcgisLayers, setArcgisLayers] = useState<Record<string, boolean>>({});
  
  // Update layers when auth status changes
  useEffect(() => {
    // Wait for auth loading to complete before setting layers
    // This prevents showing the wrong layer during auth check
    if (isLoading) {
      console.log("Auth still loading, waiting to set layers...");
      return;
    }
    
    const url = isAdmin ? LEASE_LAYER_ADMIN : LEASE_LAYER_PUBLIC;
    console.log(`Setting layer based on auth status - isAdmin: ${isAdmin}, isAuthenticated: ${isAuthenticated}`);
    console.log(`Using layer URL: ${url}`);
    setArcgisLayers({ [url]: true });
  }, [isAdmin, isAuthenticated, isLoading]);
  
  const { toast } = useToast();

  // Handle responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      // Only auto-set if user hasn't manually toggled
      if (!userToggled) {
        setSidebarOpen(!isMobile); // Open on desktop, closed on mobile
      }
    };

    // Set initial state
    handleResize();
    
    // Listen for window resize
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userToggled]);

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

  return (
    <>
      <Helmet>
        <title>CV Carbon - Survey Route Generator</title>
        <meta name="description" content="CV Carbon survey route generator - create autopilot routes with transect lines and GPX export for oyster reef surveys." />
      </Helmet>
      
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay - only on mobile and when sidebar is open */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-[9997] md:hidden"
            onClick={() => {
              setSidebarOpen(false);
              setUserToggled(true);
            }}
          />
        )}
        
        <Sidebar
          open={sidebarOpen}
          onToggle={() => {
            setSidebarOpen(!sidebarOpen);
            setUserToggled(true);
          }}
          polygon={polygon}
          onPolygonChange={handlePolygonChange}
          routeParameters={routeParameters}
          onParametersChange={handleParametersChange}
          generatedRoute={generatedRoute}
          isGenerating={isGenerating}
          onRouteGenerated={handleRouteGenerated}
          onError={handleError}
        />
        
        <div className="flex-1 relative">
          <MapContainer
            polygon={polygon}
            onPolygonChange={handlePolygonChange}
            generatedRoute={generatedRoute}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => {
              setSidebarOpen(!sidebarOpen);
              setUserToggled(true);
            }}
            arcgisLayers={arcgisLayers}
          />
        </div>
      </div>
    </>
  );
}
