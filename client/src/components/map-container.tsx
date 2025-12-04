import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Expand, Trash2, Layers, ZoomIn, ZoomOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArcGISAuth, LEASE_LAYER_ADMIN, LEASE_LAYER_PUBLIC } from "@/lib/arcgis-auth";

interface MapContainerProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  generatedRoute: any;
  sidebarOpen: boolean;
  drawingMode?: boolean;
  onDrawingModeChange?: (mode: boolean) => void;
  onToggleSidebar?: () => void;
  arcgisLayers?: Record<string, boolean>;
  selectedLease?: any;
}

export default function MapContainer({
  polygon,
  onPolygonChange,
  generatedRoute,
  sidebarOpen,
  drawingMode = false,
  onDrawingModeChange,
  onToggleSidebar,
  arcgisLayers = {},
  selectedLease,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const selectedLeaseLayerRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const arcgisLayersRef = useRef<Record<string, any>>({});
  const [mouseCoords, setMouseCoords] = useState({ lat: 29.3013, lng: -94.7977 });
  const [showLegend, setShowLegend] = useState(false);
  const { isAuthenticated } = useArcGISAuth();

  useEffect(() => {
    if (typeof window !== "undefined" && mapRef.current && !mapInstanceRef.current) {
      // Dynamically import Leaflet to avoid SSR issues
      import("leaflet").then((L) => {
        // Fix default marker icons issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        // Initialize map centered on Galveston Bay, TX
        const map = L.map(mapRef.current!).setView([29.3013, -94.7977], 12);
        
        // Add tile layer with better configuration
        const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          minZoom: 1,
          crossOrigin: true
        });
        
        tileLayer.on('tileerror', (e) => {
          console.warn('Tile loading error:', e);
        });
        
        tileLayer.addTo(map);

        // Track mouse coordinates
        map.on('mousemove', (e: any) => {
          setMouseCoords({
            lat: parseFloat(e.latlng.lat.toFixed(4)),
            lng: parseFloat(e.latlng.lng.toFixed(4))
          });
        });

        // Initialize drawing controls
        import("leaflet-draw").then(() => {
          const drawnItems = new L.FeatureGroup();
          map.addLayer(drawnItems);
          drawnItemsRef.current = drawnItems;

          const drawControl = new (L as any).Control.Draw({
            edit: {
              featureGroup: drawnItems,
            },
            draw: {
              polygon: true,
              polyline: false,
              rectangle: false,
              circle: false,
              marker: false,
              circlemarker: false,
            },
          });
          map.addControl(drawControl);
          drawControlRef.current = drawControl;

          // Handle drawing events
          map.on('draw:created', (e: any) => {
            const layer = e.layer;
            drawnItems.clearLayers(); // Clear previous drawings
            drawnItems.addLayer(layer);
            
            // Convert to GeoJSON
            const geoJSON = layer.toGeoJSON();
            onPolygonChange(geoJSON);
            onDrawingModeChange?.(false);
          });

          map.on('draw:edited', (e: any) => {
            const layers = e.layers;
            layers.eachLayer((layer: any) => {
              const geoJSON = layer.toGeoJSON();
              onPolygonChange(geoJSON);
            });
          });

          map.on('draw:deleted', () => {
            onPolygonChange(null);
          });

          map.on('draw:drawstart', () => {
            onDrawingModeChange?.(true);
          });

          map.on('draw:drawstop', () => {
            onDrawingModeChange?.(false);
          });
        });

        mapInstanceRef.current = map;
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map when polygon changes
  useEffect(() => {
    if (mapInstanceRef.current && polygon) {
      import("leaflet").then((L) => {
        // Remove existing polygon layer
        if (polygonLayerRef.current) {
          mapInstanceRef.current.removeLayer(polygonLayerRef.current);
        }
        
        // Add new polygon layer
        const polygonLayer = L.geoJSON(polygon, {
          style: {
            color: '#3b82f6',
            weight: 2,
            opacity: 0.8,
            fillColor: '#3b82f6',
            fillOpacity: 0.2
          }
        });
        
        polygonLayerRef.current = polygonLayer;
        polygonLayer.addTo(mapInstanceRef.current);
        
        // Fit map to polygon bounds
        mapInstanceRef.current.fitBounds(polygonLayer.getBounds(), { padding: [20, 20] });
      });
    }
  }, [polygon]);

  // Update map when route changes
  useEffect(() => {
    if (mapInstanceRef.current && generatedRoute) {
      import("leaflet").then((L) => {
        // Remove existing route layer
        if (routeLayerRef.current) {
          mapInstanceRef.current.removeLayer(routeLayerRef.current);
        }
        
        // Create layer group for route visualization
        const routeLayer = L.layerGroup();
        
        // Add transect lines
        if (generatedRoute.transectLines && generatedRoute.transectLines.length > 0) {
          generatedRoute.transectLines.forEach((line: any, index: number) => {
            const color = index % 2 === 0 ? '#3b82f6' : '#10b981';
            const turfLine = L.geoJSON(line, {
              style: {
                color: color,
                weight: 3,
                opacity: 0.8
              }
            });
            routeLayer.addLayer(turfLine);
          });
        }
        
        // Add waypoints
        if (generatedRoute.waypoints && generatedRoute.waypoints.length > 0) {
          generatedRoute.waypoints.forEach((waypoint: any, index: number) => {
            const isStart = index === 0;
            const marker = L.circleMarker([waypoint.lat, waypoint.lng], {
              color: isStart ? '#8b5cf6' : '#ef4444',
              weight: 2,
              opacity: 1,
              fillColor: isStart ? '#8b5cf6' : '#ef4444',
              fillOpacity: 0.8,
              radius: isStart ? 8 : 5
            }).bindPopup(`Waypoint ${index + 1}${isStart ? ' (Start)' : ''}`);
            routeLayer.addLayer(marker);
          });
        }
        
        routeLayerRef.current = routeLayer;
        routeLayer.addTo(mapInstanceRef.current);
        setShowLegend(true);
      });
    } else {
      setShowLegend(false);
    }
  }, [generatedRoute]);

  // Handle selected lease highlight
  useEffect(() => {
    if (mapInstanceRef.current && selectedLease) {
      import("leaflet").then((L) => {
        // Remove existing layer
        if (selectedLeaseLayerRef.current) {
          mapInstanceRef.current.removeLayer(selectedLeaseLayerRef.current);
        }

        // Create new layer
        const layer = L.geoJSON(selectedLease.geometry, {
          style: {
            color: '#ef4444', // Red for highlight
            weight: 4,
            opacity: 1,
            fill: false,
            dashArray: '10, 10'
          }
        });

        // Add popup
        const props = selectedLease.attributes;
        if (props) {
            const popupContent = Object.entries(props)
                .filter(([key, value]) => value !== null && value !== undefined && key !== 'OBJECTID' && key !== 'Shape__Area' && key !== 'Shape__Length')
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join('<br>');
             layer.bindPopup(`<strong>Selected Lease</strong><br>${popupContent}`);
        }

        selectedLeaseLayerRef.current = layer;
        layer.addTo(mapInstanceRef.current);
        
        // Fit bounds
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          layer.openPopup();
        }
      });
    }
  }, [selectedLease]);

  // Handle ArcGIS layers using esri-leaflet
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const loadLayers = async () => {
      // Dynamic import of esri-leaflet to work with the dynamically imported Leaflet
      const EsriLeaflet = await import("esri-leaflet");
      
      // Get authentication token if user is authenticated
      let token: string | null = null;
      if (isAuthenticated) {
        try {
          const IdentityManager = (await import("@arcgis/core/identity/IdentityManager")).default;
          const credential = await IdentityManager.checkSignInStatus("https://www.arcgis.com");
          if (credential && credential.token) {
            token = credential.token;
            console.log("Using authenticated token for ArcGIS layers");
          }
        } catch (error) {
          console.log("No authentication token available, using public access");
        }
      }

      // First, remove any layers that are no longer in the arcgisLayers object
      // This handles switching between admin/public layers
      const currentLayerUrls = new Set(Object.keys(arcgisLayers));
      Object.keys(arcgisLayersRef.current).forEach((existingUrl) => {
        if (!currentLayerUrls.has(existingUrl)) {
          console.log(`Removing stale ArcGIS layer: ${existingUrl}`);
          mapInstanceRef.current.removeLayer(arcgisLayersRef.current[existingUrl]);
          delete arcgisLayersRef.current[existingUrl];
        }
      });

      Object.entries(arcgisLayers).forEach(([layerUrl, visible]) => {
        if (visible && !arcgisLayersRef.current[layerUrl]) {
          console.log(`Adding ArcGIS layer: ${layerUrl}`);
          console.log(`Layer URL being loaded: ${layerUrl}`);
          console.log(`Is LEASE_LAYER_PUBLIC: ${layerUrl === LEASE_LAYER_PUBLIC}`);
          console.log(`Is LEASE_LAYER_ADMIN: ${layerUrl === LEASE_LAYER_ADMIN}`);
          console.log(`Token available: ${!!token}`);
          
          // Determine layer type and styling
          const isLeaseLayer = layerUrl.includes("Lease") || layerUrl === LEASE_LAYER_ADMIN || layerUrl === LEASE_LAYER_PUBLIC;
          
          try {
            // Create feature layer using esri-leaflet
            const layerOptions: any = {
              url: layerUrl,
              // Use simplifyFactor for performance with large datasets
              simplifyFactor: 0.5,
              // Precision for coordinates
              precision: 6,
            };

            // Add token if authenticated - required for both admin and public restricted layers
            if (token) {
              layerOptions.token = token;
              console.log(`Token added to layer options for ${layerUrl}`);
            } else {
              console.warn(`No token available for layer ${layerUrl} - this may cause issues if the layer requires authentication`);
            }

            const layer = EsriLeaflet.featureLayer(layerOptions);
            
            // Style configuration - esri-leaflet uses setStyle method
            const layerStyle = isLeaseLayer ? {
              color: '#fbbf24', // Yellow color
              weight: 2,
              opacity: 1,
              fillOpacity: 0 // No fill
            } : {
              color: '#3b82f6', // Blue color
              weight: 1,
              opacity: 0.7,
              fillColor: '#3b82f6',
              fillOpacity: 0.2
            };
            
            layer.setStyle(layerStyle);
            
            // Bind popups on each feature
            layer.bindPopup((featureLayer: any) => {
              const props = featureLayer.feature.properties;
              if (!props) return '';
              
              const popupContent = Object.entries(props)
                .filter(([key, value]) => value !== null && value !== undefined && key !== 'OBJECTID' && key !== 'Shape__Area' && key !== 'Shape__Length')
                .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                .join('<br>');
              
              const title = isLeaseLayer ? "Lease Boundary" : "Bedding Documentation";
              return `<strong>${title}</strong><br>${popupContent}`;
            });

            // Add event listeners for debugging
            layer.on('loading', () => {
              console.log(`Loading features from ${layerUrl}...`);
            });
            
            layer.on('load', () => {
              console.log(`Finished loading features from ${layerUrl}`);
              // Query to check feature count
              layer.query().where('1=1').count((error: any, count: number) => {
                if (error) {
                  console.error(`Error counting features for ${layerUrl}:`, error);
                } else {
                  console.log(`Layer ${layerUrl} has ${count} features`);
                  if (count === 0) {
                    console.warn(`Layer ${layerUrl} returned 0 features - this may indicate a permissions issue or empty dataset`);
                  }
                }
              });
            });
            
            layer.on('error', (e: any) => {
              console.error(`Error loading layer ${layerUrl}:`, e);
              console.error(`Error details:`, JSON.stringify(e, null, 2));
            });

            // Also listen for request errors
            layer.on('requeststart', (e: any) => {
              console.log(`Request started for ${layerUrl}`);
            });
            
            layer.on('requestend', (e: any) => {
              console.log(`Request ended for ${layerUrl}`);
            });

            // Add to map
            layer.addTo(mapInstanceRef.current);
            arcgisLayersRef.current[layerUrl] = layer;
            console.log(`Successfully added layer ${layerUrl} to map`);
            
          } catch (error) {
            console.error(`Error adding ArcGIS layer ${layerUrl}:`, error);
          }

        } else if (!visible && arcgisLayersRef.current[layerUrl]) {
          // Remove ArcGIS layer
          console.log(`Removing ArcGIS layer: ${layerUrl}`);
          mapInstanceRef.current.removeLayer(arcgisLayersRef.current[layerUrl]);
          delete arcgisLayersRef.current[layerUrl];
        }
      });
    };

    loadLayers();
  }, [arcgisLayers, isAuthenticated]);

  const handleZoomToFit = () => {
    if (mapInstanceRef.current) {
      if (polygonLayerRef.current) {
        mapInstanceRef.current.fitBounds(polygonLayerRef.current.getBounds(), { padding: [20, 20] });
      } else if (routeLayerRef.current) {
        mapInstanceRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] });
      } else {
        mapInstanceRef.current.setView([40.7128, -74.0060], 10);
      }
    }
  };

  const handleClearMap = () => {
    if (mapInstanceRef.current) {
      // Clear polygon layer
      if (polygonLayerRef.current) {
        mapInstanceRef.current.removeLayer(polygonLayerRef.current);
        polygonLayerRef.current = null;
      }
      
      // Clear route layer
      if (routeLayerRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }

      // Clear selected lease layer
      if (selectedLeaseLayerRef.current) {
        mapInstanceRef.current.removeLayer(selectedLeaseLayerRef.current);
        selectedLeaseLayerRef.current = null;
      }
      
      // Clear drawn items
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
      
      onPolygonChange(null);
    }
  };

  // Expose the clear map function globally so it can be called from the sidebar
  (window as any).mapClearFunction = handleClearMap;

  return (
    <div className="relative h-full">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="h-full w-full"
        style={{ minHeight: "100vh" }}
      />

      {/* Mobile Menu Button - Only show when sidebar is closed */}
      {!sidebarOpen && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[9999] md:hidden">
          <Button
            onClick={onToggleSidebar}
            variant="default"
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-6"
          >
            <Menu className="h-5 w-5 mr-2" />
            Menu
          </Button>
        </div>
      )}

      {/* Map Controls - Moved down to avoid conflict with menu button */}
      <div className="absolute top-20 right-4 space-y-2 hidden md:block">
        <Card className="map-controls p-2 space-y-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomToFit}
            title="Zoom to Fit"
          >
            <Expand className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearMap}
            title="Clear Map"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </Card>
      </div>

      {/* Route Legend - Positioned to avoid mobile interference */}
      {showLegend && (
        <Card className="absolute bottom-4 left-4 route-legend p-4 max-w-xs">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Route Legend
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-blue-500 rounded"></div>
              <span className="text-gray-700">Transect Lines</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-green-500 rounded"></div>
              <span className="text-gray-700">Turn Segments</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-gray-700">Waypoints</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-gray-700">Start Point</span>
            </div>
          </div>
        </Card>
      )}

      {/* Coordinates Display - Hidden per user request */}
    </div>
  );
}
