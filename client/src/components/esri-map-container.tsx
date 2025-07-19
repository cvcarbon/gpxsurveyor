import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Expand, Trash2, Layers, ZoomIn, ZoomOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

// Import ArcGIS modules
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Sketch from "@arcgis/core/widgets/Sketch";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import ExpandWidget from "@arcgis/core/widgets/Expand";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Polygon from "@arcgis/core/geometry/Polygon";
import Polyline from "@arcgis/core/geometry/Polyline";
import Point from "@arcgis/core/geometry/Point";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

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
  const mapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const sketchRef = useRef<Sketch | null>(null);
  const polygonLayerRef = useRef<GraphicsLayer | null>(null);
  const routeLayerRef = useRef<GraphicsLayer | null>(null);
  const waypointLayerRef = useRef<GraphicsLayer | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Create map with satellite basemap
    const map = new Map({
      basemap: "satellite"
    });

    // Create map view centered on Galveston Bay, TX
    const view = new MapView({
      container: mapRef.current,
      map: map,
      center: [-94.7977, 29.3013], // Galveston Bay
      zoom: 11,
      constraints: {
        rotationEnabled: false
      }
    });

    viewRef.current = view;

    // Create graphics layers
    const polygonLayer = new GraphicsLayer({
      title: "Survey Area"
    });
    const routeLayer = new GraphicsLayer({
      title: "Generated Route"
    });
    const waypointLayer = new GraphicsLayer({
      title: "Waypoints"
    });

    polygonLayerRef.current = polygonLayer;
    routeLayerRef.current = routeLayer;
    waypointLayerRef.current = waypointLayer;

    map.addMany([polygonLayer, routeLayer, waypointLayer]);

    // Create sketch widget for drawing
    const sketch = new Sketch({
      layer: polygonLayer,
      view: view,
      creationMode: "single",
      availableCreateTools: ["polygon", "rectangle"],
      defaultCreateOptions: {
        mode: "click"
      },
      visibleElements: {
        createTools: {
          point: false,
          polyline: false,
          circle: false
        },
        selectionTools: {
          "lasso-selection": false,
          "rectangle-selection": false
        },
        settingsMenu: false
      }
    });

    sketchRef.current = sketch;

    // Handle sketch create event
    sketch.on("create", (event) => {
      if (event.state === "complete") {
        const polygon = event.graphic.geometry as Polygon;
        // Convert to GeoJSON format for compatibility with existing code
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

    // Wait for view to be ready
    view.when(() => {
      // Add basemap gallery
      const basemapGallery = new BasemapGallery({
        view: view
      });

      const bgExpand = new ExpandWidget({
        view: view,
        content: basemapGallery,
        expandIconClass: "esri-icon-basemap"
      });

      view.ui.add(bgExpand, "top-right");

      // Add zoom controls
      view.ui.move("zoom", "top-right");
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
    if (!polygonLayerRef.current || !viewRef.current) return;

    polygonLayerRef.current.removeAll();

    if (polygon) {
      let rings: number[][][] = [];
      
      if (polygon.coordinates) {
        // GeoJSON format
        rings = polygon.coordinates;
      } else if (polygon.geometry?.coordinates) {
        // Feature format
        rings = polygon.geometry.coordinates;
      }

      if (rings.length > 0) {
        const polygonGeometry = new Polygon({
          rings: rings,
          spatialReference: { wkid: 4326 }
        });

        const polygonGraphic = new Graphic({
          geometry: polygonGeometry,
          symbol: new SimpleFillSymbol({
            color: [255, 178, 0, 0.4],
            outline: new SimpleLineSymbol({
              color: [255, 178, 0],
              width: 2
            })
          })
        });

        polygonLayerRef.current.add(polygonGraphic);

        // Zoom to polygon
        viewRef.current.goTo(polygonGeometry.extent.expand(1.2));
      }
    }
  }, [polygon]);

  // Update route display
  useEffect(() => {
    if (!routeLayerRef.current || !waypointLayerRef.current || !viewRef.current) return;

    routeLayerRef.current.removeAll();
    waypointLayerRef.current.removeAll();

    if (generatedRoute?.waypoints && generatedRoute.waypoints.length > 0) {
      // Create polyline from waypoints
      const paths = [generatedRoute.waypoints.map((wp: any) => [wp.lng, wp.lat])];
      
      const routePolyline = new Polyline({
        paths: paths,
        spatialReference: { wkid: 4326 }
      });

      const routeGraphic = new Graphic({
        geometry: routePolyline,
        symbol: new SimpleLineSymbol({
          color: [0, 122, 255],
          width: 3,
          style: "solid"
        })
      });

      routeLayerRef.current.add(routeGraphic);

      // Add waypoint markers (show every 10th waypoint to avoid clutter)
      generatedRoute.waypoints.forEach((wp: any, index: number) => {
        if (index % 10 === 0 || index === 0 || index === generatedRoute.waypoints.length - 1) {
          const point = new Point({
            longitude: wp.lng,
            latitude: wp.lat,
            spatialReference: { wkid: 4326 }
          });

          const waypointGraphic = new Graphic({
            geometry: point,
            symbol: new SimpleMarkerSymbol({
              color: [0, 122, 255],
              size: 6,
              outline: {
                color: [255, 255, 255],
                width: 1
              }
            })
          });

          waypointLayerRef.current.add(waypointGraphic);
        }
      });

      // Add transect lines if available
      if (generatedRoute.transectLines) {
        generatedRoute.transectLines.forEach((line: any, index: number) => {
          const coords = line.geometry.coordinates;
          const transectPolyline = new Polyline({
            paths: [[coords]],
            spatialReference: { wkid: 4326 }
          });

          const transectGraphic = new Graphic({
            geometry: transectPolyline,
            symbol: new SimpleLineSymbol({
              color: [255, 0, 0],
              width: 2,
              style: "dash"
            })
          });

          routeLayerRef.current.add(transectGraphic);
        });
      }
    }
  }, [generatedRoute]);

  // Handle drawing mode
  useEffect(() => {
    if (!sketchRef.current) return;

    if (drawingMode) {
      sketchRef.current.create("polygon");
    } else {
      sketchRef.current.cancel();
    }
  }, [drawingMode]);

  const handleClearMap = () => {
    if (polygonLayerRef.current) {
      polygonLayerRef.current.removeAll();
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.removeAll();
    }
    if (waypointLayerRef.current) {
      waypointLayerRef.current.removeAll();
    }
    onPolygonChange(null);
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      mapRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Expose functions globally for the sidebar to call
  (window as any).mapClearFunction = handleClearMap;
  (window as any).startDrawingMode = () => {
    if (onDrawingModeChange) {
      onDrawingModeChange(true);
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="absolute inset-0"
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
        {/* Additional controls can be added here */}
      </div>

      {/* Drawing Controls */}
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

      {/* Route Info */}
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