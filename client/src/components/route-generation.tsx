import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Route, Clock, MapPin, Navigation, Gauge } from "lucide-react";
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
  const [speed, setSpeed] = useState(20); // Default speed in kph
  const [routeName, setRouteName] = useState("Survey Route 1");

  // Speed conversion functions
  const convertSpeed = (speedKph: number) => {
    return {
      kph: speedKph,
      mph: speedKph * 0.621371,
      knots: speedKph * 0.539957,
    };
  };

  // Calculate estimated time based on total distance and speed
  const calculateEstimatedTime = (totalDistanceMeters: number, speedKph: number) => {
    if (!totalDistanceMeters || speedKph <= 0) return 0;
    const distanceKm = totalDistanceMeters / 1000;
    const timeHours = distanceKm / speedKph;
    return Math.round(timeHours * 60); // Convert to minutes
  };

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
        name: routeName.trim() || "Survey Route 1",
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
  const speedConversions = convertSpeed(speed);
  const dynamicEstimatedTime = hasRoute ? calculateEstimatedTime(generatedRoute.totalDistance, speed) : 0;

  return (
    <Card className="border-0 border-b border-gray-100 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Generate Route</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Route Name Input */}
        <div className="space-y-2">
          <Label htmlFor="routeName" className="text-sm font-medium">
            Route Name
          </Label>
          <Input
            id="routeName"
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="Enter route name (e.g., Survey Area 1)"
            className="w-full"
          />
          <p className="text-xs text-gray-500">
            This name will be used in the exported GPX and KML files
          </p>
        </div>

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
              
              <div className="col-span-2">
                <div className="flex items-center space-x-2 mb-3">
                  <Gauge className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500 font-medium">Speed Control</span>
                </div>
                
                <div className="space-y-3">
                  <Slider
                    value={[speed]}
                    onValueChange={(value) => setSpeed(value[0])}
                    max={60}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                  
                  {/* Speed Scale */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center bg-blue-50 rounded px-2 py-1">
                      <div className="font-medium text-blue-700">{speedConversions.kph.toFixed(1)}</div>
                      <div className="text-blue-600">kph</div>
                    </div>
                    <div className="text-center bg-green-50 rounded px-2 py-1">
                      <div className="font-medium text-green-700">{speedConversions.mph.toFixed(1)}</div>
                      <div className="text-green-600">mph</div>
                    </div>
                    <div className="text-center bg-purple-50 rounded px-2 py-1">
                      <div className="font-medium text-purple-700">{speedConversions.knots.toFixed(1)}</div>
                      <div className="text-purple-600">knots</div>
                    </div>
                  </div>
                  
                  {/* Dynamic Time Display */}
                  <div className="flex items-center justify-center space-x-2 bg-gray-100 rounded-lg py-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-600">Estimated Time:</span>
                    <span className="font-bold text-gray-900">
                      {dynamicEstimatedTime > 0 ? 
                        `${Math.floor(dynamicEstimatedTime / 60)}h ${dynamicEstimatedTime % 60}m` : 
                        'N/A'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
