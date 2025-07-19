import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "lucide-react";

// Import ArcGIS modules dynamically to avoid SSR issues
let Map: any, MapView: any, Graphic: any, GraphicsLayer: any, Sketch: any, Polygon: any, Polyline: any, Point: any;

interface MapContainerProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  generatedRoute: any;
  sidebarOpen: boolean;
  drawingMode?: boolean;
  onDrawingModeChange?: (mode: boolean) => void;
  onToggleSidebar?: () => void;
}

export default function MapContainer({
  polygon,
  onPolygonChange,
  generatedRoute,
  sidebarOpen,
  drawingMode = false,
  onDrawingModeChange,
  onToggleSidebar,
}: MapContainerProps) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<any>(null);
  const sketchRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load ArcGIS modules
    const loadModules = async () => {
      try {
        const modules = await import("@arcgis/core/Map");
        Map = modules.default;
        
        const mapViewModule = await import("@arcgis/core/views/MapView");
        MapView = mapViewModule.default;
        
        const graphicModule = await import("@arcgis/core/Graphic");
        Graphic = graphicModule.default;
        
        const layerModule = await import("@arcgis/core/layers/GraphicsLayer");
        GraphicsLayer = layerModule.default;
        
        const sketchModule = await import("@arcgis/core/widgets/Sketch");
        Sketch = sketchModule.default;
        
        const polygonModule = await import("@arcgis/core/geometry/Polygon");
        Polygon = polygonModule.default;
        
        const polylineModule = await import("@arcgis/core/geometry/Polyline");
        Polyline = polylineModule.default;
        
        const pointModule = await import("@arcgis/core/geometry/Point");
        Point = pointModule.default;
        
        setIsLoaded(true);
      } catch (error) {
        console.error("Failed to load ArcGIS modules:", error);
      }
    };

    loadModules();
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapDiv.current) return;

    // Create map
    const map = new Map({
      basemap: "satellite"
    });

    // Create view
    const view = new MapView({
      container: mapDiv.current,
      map: map,
      center: [-94.7977, 29.3013],
      zoom: 11
    });

    viewRef.current = view;

    // Create layers
    const polygonLayer = new GraphicsLayer();
    const routeLayer = new GraphicsLayer();
    
    polygonLayerRef.current = polygonLayer;
    routeLayerRef.current = routeLayer;
    
    map.addMany([polygonLayer, routeLayer]);

    // Create sketch widget with proper configuration
    const sketch = new Sketch({
      layer: polygonLayer,
      view: view,
      creationMode: "single",
      availableCreateTools: ["polygon"],
      defaultCreateOptions: {
        mode: "click"
      },
      visibleElements: {
        createTools: {
          point: false,
          polyline: false,
          rectangle: false,
          circle: false
        },
        selectionTools: {
          "lasso-selection": false,
          "rectangle-selection": false
        },
        settingsMenu: false,
        undoRedoMenu: false
      }
    });

    sketchRef.current = sketch;

    // Handle sketch events
    sketch.on("create", (event) => {
      if (event.state === "complete") {
        const polygonGeom = event.graphic.geometry as any;
        const geoJsonPolygon = {
          type: "Polygon",
          coordinates: [polygonGeom.rings[0].map((coord: number[]) => [coord[0], coord[1]])]
        };
        onPolygonChange(geoJsonPolygon);
        
        // Remove sketch from UI after completion
        view.ui.remove(sketch);
        if (onDrawingModeChange) {
          onDrawingModeChange(false);
        }
      }
    });

    // Cleanup
    return () => {
      if (view) {
        view.destroy();
      }
    };
  }, [isLoaded]);

  // Handle drawing mode
  useEffect(() => {
    if (!sketchRef.current || !viewRef.current || !isLoaded) return;
    
    if (drawingMode) {
      // Add sketch widget to UI and start drawing
      viewRef.current.ui.add(sketchRef.current, "top-left");
      setTimeout(() => {
        sketchRef.current.create("polygon");
      }, 100);
    } else {
      // Remove sketch widget from UI
      try {
        viewRef.current.ui.remove(sketchRef.current);
      } catch (e) {
        // Ignore if already removed
      }
    }
  }, [drawingMode, isLoaded]);

  // Update polygon display
  useEffect(() => {
    if (!polygonLayerRef.current || !viewRef.current || !isLoaded || drawingMode) return;
    
    // Clear existing graphics except the ones being drawn
    const existingGraphics = polygonLayerRef.current.graphics.items.filter((g: any) => 
      g.symbol && g.symbol.color && g.symbol.color[0] === 255 && g.symbol.color[1] === 178
    );
    polygonLayerRef.current.removeMany(existingGraphics);
    
    if (polygon && polygon.coordinates) {
      const polygonGeometry = new Polygon({
        rings: polygon.coordinates,
        spatialReference: { wkid: 4326 }
      });

      const polygonGraphic = new Graphic({
        geometry: polygonGeometry,
        symbol: {
          type: "simple-fill",
          color: [255, 178, 0, 0.4],
          outline: {
            color: [255, 178, 0],
            width: 2
          }
        }
      });

      polygonLayerRef.current.add(polygonGraphic);
      viewRef.current.goTo(polygonGeometry.extent.expand(1.2));
    }
  }, [polygon, isLoaded, drawingMode]);

  // Update route display
  useEffect(() => {
    if (!routeLayerRef.current || !viewRef.current || !isLoaded) return;
    
    routeLayerRef.current.removeAll();
    
    if (generatedRoute?.waypoints && generatedRoute.waypoints.length > 0) {
      const paths = [generatedRoute.waypoints.map((wp: any) => [wp.lng, wp.lat])];
      
      const routePolyline = new Polyline({
        paths: paths,
        spatialReference: { wkid: 4326 }
      });

      const routeGraphic = new Graphic({
        geometry: routePolyline,
        symbol: {
          type: "simple-line",
          color: [0, 122, 255],
          width: 3
        }
      });

      routeLayerRef.current.add(routeGraphic);

      // Add waypoint markers
      generatedRoute.waypoints.forEach((wp: any, index: number) => {
        if (index % 10 === 0 || index === 0 || index === generatedRoute.waypoints.length - 1) {
          const point = new Point({
            longitude: wp.lng,
            latitude: wp.lat,
            spatialReference: { wkid: 4326 }
          });

          const waypointGraphic = new Graphic({
            geometry: point,
            symbol: {
              type: "simple-marker",
              color: [0, 122, 255],
              size: 6,
              outline: {
                color: [255, 255, 255],
                width: 1
              }
            }
          });

          routeLayerRef.current.add(waypointGraphic);
        }
      });
    }
  }, [generatedRoute, isLoaded]);

  const handleClearMap = () => {
    if (polygonLayerRef.current) {
      polygonLayerRef.current.removeAll();
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.removeAll();
    }
    onPolygonChange(null);
  };

  // Expose functions globally
  (window as any).mapClearFunction = handleClearMap;
  (window as any).startDrawingMode = () => {
    if (onDrawingModeChange) {
      onDrawingModeChange(true);
    }
  };

  if (!isLoaded) {
    return (
      <div className="relative h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={mapDiv} className="h-full w-full" />
      
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

      {drawingMode && (
        <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 p-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <p className="text-sm font-medium">Use the polygon tool in the top-left to draw your survey area</p>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (onDrawingModeChange) {
                  onDrawingModeChange(false);
                }
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {generatedRoute && (
        <Card className="absolute bottom-4 right-4 p-4 shadow-lg max-w-xs">
          <h3 className="font-semibold mb-2">Route Information</h3>
          <div className="space-y-1 text-sm">
            <p>Total Distance: {(generatedRoute.totalDistance / 1000).toFixed(2)} km</p>
            <p>Estimated Time: {generatedRoute.estimatedTime} min</p>
            <p>Bearing: {generatedRoute.bearing}°</p>
            <p>Transect Distance: {generatedRoute.distance}m</p>
          </div>
        </Card>
      )}
    </div>
  );
}