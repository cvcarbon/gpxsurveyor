import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "lucide-react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Sketch from "@arcgis/core/widgets/Sketch";
import Polygon from "@arcgis/core/geometry/Polygon";
import Polyline from "@arcgis/core/geometry/Polyline";
import Point from "@arcgis/core/geometry/Point";

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
  const viewRef = useRef<MapView | null>(null);
  const sketchRef = useRef<Sketch | null>(null);
  const polygonLayerRef = useRef<GraphicsLayer | null>(null);
  const routeLayerRef = useRef<GraphicsLayer | null>(null);

  useEffect(() => {
    if (!mapDiv.current) return;

    // Create a simple map
    const map = new Map({
      basemap: "satellite"
    });

    // Create the view
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
    
    map.add(polygonLayer);
    map.add(routeLayer);

    // Create sketch widget
    const sketch = new Sketch({
      layer: polygonLayer,
      view: view,
      creationMode: "single"
    });

    sketchRef.current = sketch;

    // Handle drawing
    sketch.on("create", (event) => {
      if (event.state === "complete") {
        const polygon = event.graphic.geometry as Polygon;
        const geoJsonPolygon = {
          type: "Polygon",
          coordinates: [polygon.rings[0].map(coord => [coord[0], coord[1]])]
        };
        onPolygonChange(geoJsonPolygon);
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
  }, []);

  // Handle drawing mode
  useEffect(() => {
    if (!sketchRef.current) return;
    
    if (drawingMode) {
      sketchRef.current.create("polygon");
    } else {
      sketchRef.current.cancel();
    }
  }, [drawingMode]);

  // Update polygon display
  useEffect(() => {
    if (!polygonLayerRef.current || !viewRef.current) return;
    
    polygonLayerRef.current.removeAll();
    
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
  }, [polygon]);

  // Update route display
  useEffect(() => {
    if (!routeLayerRef.current || !viewRef.current) return;
    
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
    }
  }, [generatedRoute]);

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
            <p className="text-sm font-medium">Click points on the map to draw a polygon</p>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (sketchRef.current) {
                  sketchRef.current.cancel();
                }
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