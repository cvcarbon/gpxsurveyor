import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Expand, Trash2, Layers, ZoomIn, ZoomOut, Menu, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EsriMapContainerProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  generatedRoute: any;
  sidebarOpen: boolean;
  drawingMode?: boolean;
  onDrawingModeChange?: (mode: boolean) => void;
  onToggleSidebar?: () => void;
}

declare global {
  interface Window {
    require: any;
  }
}

export default function EsriMapContainer({
  polygon,
  onPolygonChange,
  generatedRoute,
  sidebarOpen,
  drawingMode = false,
  onDrawingModeChange,
  onToggleSidebar,
}: EsriMapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [sketch, setSketch] = useState<any>(null);
  const [layerUrls, setLayerUrls] = useState<string[]>(['']);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [addedLayers, setAddedLayers] = useState<any[]>([]);

  // Initialize Esri Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Use the global require from ArcGIS API
    window.require([
      "esri/Map",
      "esri/views/MapView",
      "esri/widgets/Sketch",
      "esri/layers/GraphicsLayer",
      "esri/layers/MapImageLayer",
      "esri/layers/FeatureLayer",
      "esri/geometry/Polygon",
      "esri/Graphic",
      "esri/symbols/SimpleFillSymbol",
      "esri/symbols/SimpleLineSymbol",
      "esri/Color"
    ], (
      Map: any,
      MapView: any,
      Sketch: any,
      GraphicsLayer: any,
      MapImageLayer: any,
      FeatureLayer: any,
      Polygon: any,
      Graphic: any,
      SimpleFillSymbol: any,
      SimpleLineSymbol: any,
      Color: any
    ) => {
      // Create graphics layers
      const polygonLayer = new GraphicsLayer({ id: "polygon-layer" });
      const routeLayer = new GraphicsLayer({ id: "route-layer" });

      // Create map
      const esriMap = new Map({
        basemap: "hybrid",
        layers: [polygonLayer, routeLayer]
      });

      // Create view
      const mapView = new MapView({
        container: mapRef.current,
        map: esriMap,
        center: [-94.7977, 29.3013], // Galveston Bay, TX
        zoom: 12,
        ui: {
          components: ["attribution", "zoom"] // Remove default widgets
        }
      });

      // Create sketch widget for drawing
      const sketchWidget = new Sketch({
        layer: polygonLayer,
        view: mapView,
        creationMode: "single",
        availableCreateTools: ["polygon"],
        defaultCreateOptions: {
          hasZ: false
        },
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

      // Listen for sketch events
      sketchWidget.on("create", (event: any) => {
        if (event.state === "complete") {
          const geometry = event.graphic.geometry;
          if (geometry && geometry.type === "polygon" && geometry.rings && geometry.rings.length > 0) {
            // Convert Esri polygon to GeoJSON
            const coordinates = geometry.rings[0].map((ring: number[]) => [ring[0], ring[1]]);
            // Ensure the polygon is closed
            if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
                coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
              coordinates.push([coordinates[0][0], coordinates[0][1]]);
            }
            const geoJsonPolygon = {
              type: "Polygon",
              coordinates: [coordinates]
            };
            onPolygonChange(geoJsonPolygon);
          }
        }
      });

      sketchWidget.on("update", (event: any) => {
        if (event.state === "complete" && event.graphics && event.graphics.length > 0) {
          const geometry = event.graphics[0].geometry;
          if (geometry && geometry.type === "polygon" && geometry.rings && geometry.rings.length > 0) {
            // Convert Esri polygon to GeoJSON
            const coordinates = geometry.rings[0].map((ring: number[]) => [ring[0], ring[1]]);
            // Ensure the polygon is closed
            if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
                coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
              coordinates.push([coordinates[0][0], coordinates[0][1]]);
            }
            const geoJsonPolygon = {
              type: "Polygon",
              coordinates: [coordinates]
            };
            onPolygonChange(geoJsonPolygon);
          }
        }
      });

      // Store references
      setMap(esriMap);
      setView(mapView);
      setSketch(sketchWidget);

      // Expose references for cleanup and global access
      (window as any).mapClearFunction = handleClearMap;
      (window as any).esriMapView = mapView;
      (window as any).esriMap = esriMap;
    });

    // Cleanup
    return () => {
      if (view) {
        view.destroy();
      }
    };
  }, []);

  // Update polygon display
  useEffect(() => {
    if (!map || !view) return;

    window.require([
      "esri/Graphic",
      "esri/geometry/Polygon",
      "esri/symbols/SimpleFillSymbol",
      "esri/symbols/SimpleLineSymbol"
    ], (Graphic: any, Polygon: any, SimpleFillSymbol: any, SimpleLineSymbol: any) => {
      const polygonLayer = map.findLayerById("polygon-layer");
      if (!polygonLayer) return;
      
      // Only clear if we're not in drawing mode to avoid conflicts with sketch widget
      if (!drawingMode) {
        polygonLayer.removeAll();
      }

      if (polygon && polygon.coordinates && polygon.coordinates.length > 0) {
        try {
          const esriPolygon = new Polygon({
            rings: polygon.coordinates,
            spatialReference: { wkid: 4326 }
          });

          const polygonGraphic = new Graphic({
            geometry: esriPolygon,
            symbol: new SimpleFillSymbol({
              color: [0, 100, 255, 0.3],
              outline: new SimpleLineSymbol({
                color: [0, 100, 255],
                width: 2
              })
            })
          });

          // Only add if not already drawing to avoid conflicts
          if (!drawingMode) {
            polygonLayer.add(polygonGraphic);
            view.goTo(polygonGraphic.geometry.extent.expand(1.2));
          }
        } catch (error) {
          console.warn("Error displaying polygon:", error);
        }
      }
    });
  }, [polygon, map, view, drawingMode]);

  // Update route display
  useEffect(() => {
    if (!map || !view || !generatedRoute) return;

    window.require([
      "esri/Graphic",
      "esri/geometry/Polyline",
      "esri/geometry/Point",
      "esri/symbols/SimpleLineSymbol",
      "esri/symbols/SimpleMarkerSymbol"
    ], (Graphic: any, Polyline: any, Point: any, SimpleLineSymbol: any, SimpleMarkerSymbol: any) => {
      const routeLayer = map.findLayerById("route-layer");
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
        generatedRoute.waypoints.forEach((waypoint: any, index: number) => {
          const point = new Point({
            longitude: waypoint.lng,
            latitude: waypoint.lat,
            spatialReference: { wkid: 4326 }
          });

          const waypointGraphic = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
              color: [255, 255, 0],
              size: 6,
              outline: {
                color: [0, 0, 0],
                width: 1
              }
            })
          });

          routeLayer.add(waypointGraphic);
        });
      }
    });
  }, [generatedRoute, map, view]);

  const handleAddLayer = (url: string) => {
    if (!map || !url.trim()) return;

    window.require([
      "esri/layers/MapImageLayer",
      "esri/layers/FeatureLayer"
    ], (MapImageLayer: any, FeatureLayer: any) => {
      try {
        let layer;
        if (url.includes('MapServer')) {
          layer = new MapImageLayer({
            url: url,
            title: `Layer ${addedLayers.length + 1}`
          });
        } else {
          layer = new FeatureLayer({
            url: url,
            title: `Layer ${addedLayers.length + 1}`
          });
        }

        map.add(layer);
        setAddedLayers(prev => [...prev, { id: layer.id, title: layer.title, url }]);
      } catch (error) {
        console.error("Failed to add layer:", error);
      }
    });
  };

  const handleRemoveLayer = (layerId: string) => {
    if (!map) return;
    
    const layer = map.findLayerById(layerId);
    if (layer) {
      map.remove(layer);
      setAddedLayers(prev => prev.filter(l => l.id !== layerId));
    }
  };

  const handleClearMap = () => {
    if (!map || !sketch || !view) return;
    
    // Cancel any active drawing first
    try {
      sketch.cancel();
      view.ui.remove(sketch);
      onDrawingModeChange?.(false);
    } catch (e) {
      // Ignore errors
    }
    
    const polygonLayer = map.findLayerById("polygon-layer");
    const routeLayer = map.findLayerById("route-layer");
    
    if (polygonLayer) polygonLayer.removeAll();
    if (routeLayer) routeLayer.removeAll();
    
    onPolygonChange(null);
  };

  const toggleDrawing = () => {
    if (!sketch || !view) return;
    
    if (drawingMode) {
      // Cancel any active drawing
      try {
        sketch.cancel();
      } catch (e) {
        // Ignore errors when canceling
      }
      view.ui.remove(sketch);
      onDrawingModeChange?.(false);
    } else {
      // Clear existing graphics before starting new draw
      const polygonLayer = map?.findLayerById("polygon-layer");
      if (polygonLayer) {
        polygonLayer.removeAll();
      }
      
      view.ui.add(sketch, "top-right");
      
      // Start drawing with a small delay to ensure UI is ready
      setTimeout(() => {
        try {
          sketch.create("polygon");
        } catch (e) {
          console.warn("Could not start polygon creation:", e);
        }
      }, 100);
      
      onDrawingModeChange?.(true);
    }
  };

  return (
    <div className="relative h-full">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="h-full w-full"
        style={{ minHeight: "100vh" }}
      />

      {/* Sidebar Toggle Button (shown when sidebar is closed) */}
      {!sidebarOpen && onToggleSidebar && (
        <div className="absolute top-4 left-4">
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

      {/* Map Controls */}
      <div className="absolute top-4 right-4 space-y-2">
        <Card className="map-controls p-2 space-y-2">
          <Button
            variant={drawingMode ? "default" : "outline"}
            size="sm"
            onClick={toggleDrawing}
            className="w-full"
          >
            Draw Polygon
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearMap}
            className="w-full text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            className="w-full"
          >
            <Layers className="h-4 w-4 mr-2" />
            Layers
          </Button>
        </Card>
      </div>

      {/* Layer Panel */}
      {showLayerPanel && (
        <div className="absolute top-4 right-48 w-80">
          <Card className="p-4 space-y-4 bg-white shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Esri Layers</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLayerPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {layerUrls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Esri REST Service URL"
                    value={url}
                    onChange={(e) => {
                      const newUrls = [...layerUrls];
                      newUrls[index] = e.target.value;
                      setLayerUrls(newUrls);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddLayer(url)}
                    disabled={!url.trim()}
                  >
                    Add
                  </Button>
                </div>
              ))}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLayerUrls([...layerUrls, ''])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Layer
              </Button>
            </div>

            {addedLayers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Active Layers:</Label>
                {addedLayers.map((layer) => (
                  <div key={layer.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm truncate">{layer.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLayer(layer.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Route Legend */}
      {generatedRoute && (
        <div className="absolute bottom-4 right-4">
          <Card className="route-legend p-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Route Legend</div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-0.5 bg-red-500"></div>
                <span>Even Lines</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-4 h-0.5 bg-green-500"></div>
                <span>Odd Lines</span>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span>Waypoints</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}