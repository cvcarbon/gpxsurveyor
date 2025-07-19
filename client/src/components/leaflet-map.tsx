import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "lucide-react";
import L from "leaflet";
import "leaflet-draw";

// Fix Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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
  const mapInstanceRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: [29.3013, -94.7977], // Galveston Bay, TX
      zoom: 11,
      zoomControl: false
    });

    // Add satellite imagery
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    }).addTo(map);

    // Add zoom control to top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Create feature groups
    const drawnItems = new L.FeatureGroup();
    const routeLayer = new L.LayerGroup();
    
    map.addLayer(drawnItems);
    map.addLayer(routeLayer);

    drawnItemsRef.current = drawnItems;
    routeLayerRef.current = routeLayer;
    mapInstanceRef.current = map;

    // Create draw control
    const drawControl = new L.Control.Draw({
      position: 'topleft',
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems,
        remove: true
      }
    });

    drawControlRef.current = drawControl;

    // Handle draw events
    map.on(L.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer;
      drawnItems.addLayer(layer);
      
      // Convert to GeoJSON
      const geoJson = layer.toGeoJSON();
      onPolygonChange(geoJson.geometry);
      
      // Remove draw control after creating
      map.removeControl(drawControl);
      if (onDrawingModeChange) {
        onDrawingModeChange(false);
      }
    });

    map.on(L.Draw.Event.DELETED, () => {
      onPolygonChange(null);
    });

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Handle drawing mode
  useEffect(() => {
    if (!mapInstanceRef.current || !drawControlRef.current) return;
    
    if (drawingMode) {
      mapInstanceRef.current.addControl(drawControlRef.current);
    } else {
      try {
        mapInstanceRef.current.removeControl(drawControlRef.current);
      } catch (e) {
        // Control might not be added
      }
    }
  }, [drawingMode]);

  // Update polygon display
  useEffect(() => {
    if (!drawnItemsRef.current || !mapInstanceRef.current || drawingMode) return;
    
    drawnItemsRef.current.clearLayers();
    
    if (polygon && polygon.coordinates) {
      // Convert GeoJSON to Leaflet coordinates
      const coords = polygon.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]);
      
      const polygonLayer = L.polygon(coords, {
        color: '#ffb200',
        fillColor: '#ffb200',
        fillOpacity: 0.4,
        weight: 2
      });
      
      drawnItemsRef.current.addLayer(polygonLayer);
      mapInstanceRef.current.fitBounds(polygonLayer.getBounds(), { padding: [20, 20] });
    }
  }, [polygon, drawingMode]);

  // Update route display
  useEffect(() => {
    if (!routeLayerRef.current || !mapInstanceRef.current) return;
    
    routeLayerRef.current.clearLayers();
    
    if (generatedRoute?.waypoints && generatedRoute.waypoints.length > 0) {
      // Create route line
      const routeCoords = generatedRoute.waypoints.map((wp: any) => [wp.lat, wp.lng]);
      
      const routeLine = L.polyline(routeCoords, {
        color: '#007AFF',
        weight: 3,
        opacity: 0.8
      });
      
      routeLayerRef.current.addLayer(routeLine);

      // Add waypoint markers
      generatedRoute.waypoints.forEach((wp: any, index: number) => {
        if (index % 15 === 0) {
          const marker = L.circleMarker([wp.lat, wp.lng], {
            radius: 4,
            fillColor: '#007AFF',
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          });
          routeLayerRef.current!.addLayer(marker);
        }
      });
    }
  }, [generatedRoute]);

  const handleClearMap = () => {
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
    onPolygonChange(null);
  };

  // Global functions
  (window as any).mapClearFunction = handleClearMap;
  (window as any).startDrawingMode = () => {
    if (onDrawingModeChange) {
      onDrawingModeChange(true);
    }
  };

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="absolute inset-0 w-full h-full" />
      
      {!sidebarOpen && onToggleSidebar && (
        <div className="absolute top-4 left-4 z-[1000]">
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
        <Card className="absolute bottom-4 left-1/2 transform -translate-x-1/2 p-3 shadow-lg z-[1000]">
          <div className="flex items-center space-x-3">
            <p className="text-sm font-medium">Use the polygon tool (top-left) to draw your survey area</p>
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
        <Card className="absolute bottom-4 right-4 p-4 shadow-lg max-w-xs z-[1000]">
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