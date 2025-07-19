import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Menu, Edit3 } from "lucide-react";

interface BasicMapProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  generatedRoute: any;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
}

export default function BasicMap({
  polygon,
  onPolygonChange,
  generatedRoute,
  sidebarOpen,
  onToggleSidebar,
}: BasicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string>("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [sketch, setSketch] = useState<any>(null);
  const [mapView, setMapView] = useState<any>(null);
  const [routeLayer, setRouteLayer] = useState<any>(null);

  useEffect(() => {
    let view: any = null;

    const initializeMap = async () => {
      if (!mapRef.current) return;

      try {
        // Wait for Esri to be available
        if (typeof (window as any).require === 'undefined') {
          throw new Error('Esri API not loaded');
        }

        const [Map, MapView, Sketch, GraphicsLayer, Graphic, SimpleLineSymbol, SimpleMarkerSymbol] = await new Promise((resolve, reject) => {
          (window as any).require([
            "esri/Map",
            "esri/views/MapView",
            "esri/widgets/Sketch",
            "esri/layers/GraphicsLayer",
            "esri/Graphic",
            "esri/symbols/SimpleLineSymbol",
            "esri/symbols/SimpleMarkerSymbol"
          ], (...modules: any[]) => {
            resolve(modules);
          }, (error: any) => {
            reject(error);
          });
        });

        // Create graphics layers for drawing and routes
        const graphicsLayer = new (GraphicsLayer as any)();
        const routeGraphicsLayer = new (GraphicsLayer as any)();
        
        const map = new (Map as any)({
          basemap: "satellite",
          layers: [graphicsLayer, routeGraphicsLayer]
        });

        view = new (MapView as any)({
          container: mapRef.current,
          map: map,
          center: [-94.7977, 29.3013], // Galveston Bay, TX
          zoom: 11
        });

        // Create sketch widget
        const sketchWidget = new (Sketch as any)({
          layer: graphicsLayer,
          view: view,
          creationMode: "single",
          availableCreateTools: ["polygon"],
          visibleElements: {
            createTools: {
              point: false,
              polyline: false,
              rectangle: false,
              circle: false
            },
            selectionTools: {
              "rectangle-selection": false,
              "lasso-selection": false
            },
            settingsMenu: false,
            undoRedoMenu: false
          }
        });

        // Handle sketch events
        sketchWidget.on("create", (event: any) => {
          if (event.state === "complete") {
            const geometry = event.graphic.geometry;
            if (geometry && geometry.type === "polygon" && geometry.rings && geometry.rings.length > 0) {
              const coordinates = geometry.rings[0].map((ring: number[]) => [ring[0], ring[1]]);
              // Ensure polygon is closed
              if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
                  coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
                coordinates.push([coordinates[0][0], coordinates[0][1]]);
              }
              const geoJsonPolygon = {
                type: "Polygon",
                coordinates: [coordinates]
              };
              onPolygonChange(geoJsonPolygon);
              setIsDrawing(false);
              view.ui.remove(sketchWidget);
            }
          }
        });

        await view.when();
        console.log("Basic map initialized successfully");
        setMapView(view);
        setSketch(sketchWidget);
        setRouteLayer(routeGraphicsLayer);
        setMapReady(true);
        setError("");

      } catch (err) {
        console.error("Map initialization error:", err);
        setError(err instanceof Error ? err.message : "Map failed to load");
        setMapReady(false);
      }
    };

    // Initialize after a short delay
    const timer = setTimeout(initializeMap, 200);

    return () => {
      clearTimeout(timer);
      if (view) {
        try {
          view.destroy();
        } catch (e) {
          console.warn("Error destroying map view:", e);
        }
      }
    };
  }, []);

  // Display generated route on map
  useEffect(() => {
    if (!mapView || !routeLayer || !generatedRoute) return;

    (window as any).require([
      "esri/Graphic",
      "esri/geometry/Polyline", 
      "esri/geometry/Point",
      "esri/symbols/SimpleLineSymbol",
      "esri/symbols/SimpleMarkerSymbol"
    ], (Graphic: any, Polyline: any, Point: any, SimpleLineSymbol: any, SimpleMarkerSymbol: any) => {
      // Clear existing route graphics
      routeLayer.removeAll();

      // Add transect lines
      if (generatedRoute.transectLines) {
        generatedRoute.transectLines.forEach((line: any, index: number) => {
          const esriPolyline = new Polyline({
            paths: [line.geometry.coordinates],
            spatialReference: { wkid: 4326 }
          });

          const lineGraphic = new Graphic({
            geometry: esriPolyline,
            symbol: new SimpleLineSymbol({
              color: index % 2 === 0 ? [255, 0, 0] : [0, 255, 0],
              width: 3
            })
          });

          routeLayer.add(lineGraphic);
        });
      }

      // Add waypoints
      if (generatedRoute.waypoints) {
        generatedRoute.waypoints.forEach((waypoint: any) => {
          const point = new Point({
            longitude: waypoint.lng,
            latitude: waypoint.lat,
            spatialReference: { wkid: 4326 }
          });

          const waypointGraphic = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
              color: [255, 255, 0],
              size: 4,
              outline: {
                color: [0, 0, 0],
                width: 1
              }
            })
          });

          routeLayer.add(waypointGraphic);
        });
      }

      console.log("Route displayed on map:", generatedRoute.transectLines?.length, "lines");
    });
  }, [generatedRoute, mapView, routeLayer]);

  const handleClear = () => {
    if (sketch && mapView) {
      try {
        sketch.cancel();
        mapView.ui.remove(sketch);
      } catch (e) {
        // Ignore errors
      }
      setIsDrawing(false);
    }
    
    // Clear route graphics
    if (routeLayer) {
      routeLayer.removeAll();
    }
    
    onPolygonChange(null);
  };

  const handleDrawPolygon = () => {
    if (!sketch || !mapView) return;
    
    if (isDrawing) {
      // Cancel drawing
      try {
        sketch.cancel();
        mapView.ui.remove(sketch);
      } catch (e) {
        // Ignore errors
      }
      setIsDrawing(false);
    } else {
      // Start drawing
      const graphicsLayer = mapView.map.layers.getItemAt(0);
      if (graphicsLayer) {
        graphicsLayer.removeAll();
      }
      
      mapView.ui.add(sketch, "top-right");
      setIsDrawing(true);
      
      setTimeout(() => {
        try {
          sketch.create("polygon");
        } catch (e) {
          console.warn("Could not start polygon creation:", e);
        }
      }, 100);
    }
  };

  return (
    <div className="relative h-full w-full bg-gray-100">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="h-full w-full"
        style={{ 
          height: "100vh",
          width: "100%",
          minHeight: "400px"
        }}
      />

      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Card className="p-6 max-w-md">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Map Error</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
          </Card>
        </div>
      )}

      {/* Loading Indicator */}
      {!mapReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <Card className="p-6">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm">Loading Esri Map...</span>
            </div>
          </Card>
        </div>
      )}

      {/* Sidebar Toggle */}
      {!sidebarOpen && onToggleSidebar && (
        <div className="absolute top-4 left-4 z-10">
          <Button
            onClick={onToggleSidebar}
            variant="default"
            size="icon"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Controls */}
      {mapReady && (
        <div className="absolute top-4 right-4 z-10">
          <Card className="p-2 space-y-2">
            <Button
              variant={isDrawing ? "default" : "outline"}
              size="sm"
              onClick={handleDrawPolygon}
              className="w-full"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              {isDrawing ? "Cancel Draw" : "Draw Polygon"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="w-full text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </Card>
        </div>
      )}

      {/* Status */}
      <div className="absolute bottom-4 left-4 z-10">
        <Card className="p-3">
          <div className="text-sm font-medium">
            Status: {mapReady ? "Map Ready" : error ? "Error" : "Loading..."}
          </div>
          {generatedRoute && (
            <div className="text-xs text-gray-600 mt-1">
              Route: {generatedRoute.transectLines?.length || 0} lines, {generatedRoute.waypoints?.length || 0} waypoints
            </div>
          )}
          {polygon && !generatedRoute && (
            <div className="text-xs text-gray-600 mt-1">
              Polygon loaded
            </div>
          )}
          {isDrawing && (
            <div className="text-xs text-blue-600 mt-1">
              Click to draw polygon points
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}