import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Route, Clock, MapPin, Navigation } from "lucide-react";
import { RouteParameters } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface RouteGenerationProps {
  polygon: any;
  parameters: RouteParameters;
  generatedRoute: any;
  isGenerating: boolean;
  onRouteGenerated: (route: any) => void;
  onError: (error: string) => void;
}

export default function RouteGeneration({
  polygon,
  parameters,
  generatedRoute,
  isGenerating,
  onRouteGenerated,
  onError,
}: RouteGenerationProps) {
  const [localGenerating, setLocalGenerating] = useState(false);

  const handleGenerateRoute = async () => {
    if (!polygon) {
      onError("Please define a polygon first");
      return;
    }

    setLocalGenerating(true);
    try {
      const response = await apiRequest("POST", "/api/generate-route", {
        polygon,
        parameters,
      });
      
      const result = await response.json();
      onRouteGenerated(result);
    } catch (error) {
      onError("Failed to generate route");
    } finally {
      setLocalGenerating(false);
    }
  };

  const isGeneratingRoute = isGenerating || localGenerating;
  const hasRoute = generatedRoute && generatedRoute.waypoints;

  return (
    <Card className="border-0 border-b border-gray-100 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Generate Route</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGenerateRoute}
          disabled={!polygon || isGeneratingRoute}
          className="w-full"
          size="lg"
        >
          {isGeneratingRoute ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating Route...
            </>
          ) : (
            <>
              <Route className="h-4 w-4 mr-2" />
              Generate Transect Route
            </>
          )}
        </Button>

        {/* Route Statistics */}
        {hasRoute && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Route Statistics
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center space-x-2">
                <Navigation className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-500">Total Distance:</span>
                  <span className="font-medium ml-1">
                    {generatedRoute.totalDistance ? 
                      `${(generatedRoute.totalDistance / 1000).toFixed(1)} km` : 
                      'N/A'
                    }
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Route className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-500">Transect Lines:</span>
                  <span className="font-medium ml-1">
                    {generatedRoute.transectLines?.length || 0}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-500">Waypoints:</span>
                  <span className="font-medium ml-1">
                    {generatedRoute.waypoints?.length || 0}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-gray-500">Est. Time:</span>
                  <span className="font-medium ml-1">
                    {generatedRoute.estimatedTime ? 
                      `${generatedRoute.estimatedTime} min` : 
                      'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
