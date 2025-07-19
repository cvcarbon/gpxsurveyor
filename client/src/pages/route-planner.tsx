import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import Sidebar from "@/components/sidebar";
import BasicMap from "@/components/basic-map";
import { useToast } from "@/hooks/use-toast";
import { RouteParameters } from "@shared/schema";

export default function RoutePlanner() {
  // Start with sidebar closed on mobile, open on desktop
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Set default sidebar state based on screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const isMobile = window.innerWidth < 768; // md breakpoint
      setSidebarOpen(!isMobile);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  const [polygon, setPolygon] = useState<any>(null);
  const [routeParameters, setRouteParameters] = useState<RouteParameters>({
    distance: 50,
    bearing: 0,
    overlap: 10,
    turnRadius: 20,
  });
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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

  return (
    <>
      <Helmet>
        <title>GPX Surveyor - Autopilot Route Generator</title>
        <meta name="description" content="Generate autopilot survey routes with transect lines and GPX export from uploaded or drawn polygons for Garmin chartplotters and drones." />
      </Helmet>
      
      <div className="flex h-screen overflow-hidden">
        {/* Mobile-responsive Sidebar */}
        <div className={`
          ${sidebarOpen 
            ? 'fixed inset-0 z-50 md:relative md:inset-auto md:w-96' 
            : 'hidden md:block md:w-0'
          }
          transition-all duration-300 overflow-hidden
        `}>
          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-40"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          
          <div className={`
            relative z-10 h-full bg-white
            ${sidebarOpen ? 'w-80 md:w-96' : 'w-0'}
            transition-all duration-300
          `}>
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
            />
          </div>
        </div>
        
        <div className="flex-1 relative">
          <BasicMap
            polygon={polygon}
            onPolygonChange={handlePolygonChange}
            generatedRoute={generatedRoute}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          />
        </div>
      </div>
    </>
  );
}
