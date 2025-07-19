import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Expand, Trash2, Layers, ZoomIn, ZoomOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const mapInstanceRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const esriLayersRef = useRef<any[]>([]);
  const [mouseCoords, setMouseCoords] = useState({ lat: 29.3013, lng: -94.7977 });
  const [showLegend, setShowLegend] = useState(false);

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

        // Add Esri REST service layers automatically
        import("esri-leaflet").then((esriLeaflet) => {
          console.log("Loading Lease Boundaries and Infrastructure layers...");
          
          let authPromptShown = false;
          let currentToken = localStorage.getItem('arcgis_token');
          
          const layerConfigs = [
            {
              name: 'Lease Boundaries',
              url: "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Lease_Boundaries_Leasee_View/FeatureServer/0",
              color: '#ff7800'
            },
            {
              name: 'Bedding Documentation', 
              url: "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Bedding_Documentation_view/FeatureServer/0",
              color: '#0078ff'
            }
          ];

          const showAuthPrompt = () => {
            if (!authPromptShown) {
              authPromptShown = true;
              // Check for OAuth client ID in environment or local storage
              let clientId = import.meta.env.VITE_ARCGIS_CLIENT_ID || localStorage.getItem('arcgis_client_id');
              
              if (!clientId) {
                console.log("No OAuth App ID configured. Please set it in Map Settings.");
                return;
              }
              
              const currentUrl = window.location.origin + window.location.pathname;
              console.log("Current URL for redirect:", currentUrl);
              
              const userConfirm = confirm(`These map layers require ArcGIS authentication. 

IMPORTANT: Make sure your ArcGIS app has this redirect URI configured:
${currentUrl}

Click OK to continue to sign in.`);
              
              if (userConfirm) {
                const redirectUri = encodeURIComponent(currentUrl);
                const authUrl = `https://www.arcgis.com/sharing/rest/oauth2/authorize?client_id=${clientId}&response_type=token&expiration=1440&redirect_uri=${redirectUri}`;
                console.log("Opening authentication URL:", authUrl);
                console.log("Make sure this redirect URI is configured in your ArcGIS app:", currentUrl);
                window.location.href = authUrl;
              }
            }
          };

          // Check for token in URL (after OAuth redirect)
          const urlParams = new URLSearchParams(window.location.hash.substring(1));
          const tokenFromUrl = urlParams.get('access_token');
          if (tokenFromUrl) {
            console.log("Found token in URL, saving to localStorage");
            localStorage.setItem('arcgis_token', tokenFromUrl);
            currentToken = tokenFromUrl;
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            // Reload page to apply token to layers
            window.location.reload();
            return;
          }

          // If we have a token, create authenticated layers
          if (currentToken) {
            console.log("Using stored authentication token for layers");
            
            layerConfigs.forEach((config) => {
              const layer = esriLeaflet.featureLayer({
                url: config.url,
                token: currentToken,
                style: {
                  color: config.color,
                  weight: 2,
                  opacity: 0.8,
                  fillOpacity: 0.3
                }
              });

              layer.on('loading', () => {
                console.log(`Loading ${config.name} features with token...`);
              });

              layer.on('load', () => {
                console.log(`${config.name} authenticated layer loaded successfully`);
              });

              layer.on('addfeature', (e: any) => {
                console.log(`${config.name} - Feature added:`, e.feature.properties);
              });

              layer.on('requesterror', (error: any) => {
                console.error(`${config.name} authenticated request failed:`, error);
                // Clear invalid token and retry
                localStorage.removeItem('arcgis_token');
                showAuthPrompt();
              });

              layer.addTo(map);
              esriLayersRef.current.push(layer);
            });
          } else {
            // No token - show placeholder layers that will trigger auth
            console.log("No token available - creating placeholder layers");
            
            layerConfigs.forEach((config) => {
              // Test the endpoint first
              fetch(`${config.url}?f=json`)
                .then(response => response.json())
                .then(data => {
                  if (data.error && (data.error.code === 499 || data.error.code === 403 || data.error.code === 401)) {
                    console.log(`${config.name} requires authentication - prompting user`);
                    if (!authPromptShown) {
                      showAuthPrompt();
                    }
                  } else {
                    console.log(`${config.name} service info:`, data);
                    // Create the layer if no auth needed
                    const layer = esriLeaflet.featureLayer({
                      url: config.url,
                      style: {
                        color: config.color,
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.3
                      }
                    });

                    layer.addTo(map);
                    esriLayersRef.current.push(layer);
                  }
                })
                .catch(error => {
                  console.error(`Error testing ${config.name}:`, error);
                });
            });
          }

          console.log("All layers initialized");
        }).catch((error) => {
          console.error('Error loading esri-leaflet:', error);
        });

        mapInstanceRef.current = map;
        console.log("Basic map initialized successfully");
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
      
      // Clear drawn items
      if (drawnItemsRef.current) {
        drawnItemsRef.current.clearLayers();
      }
      
      onPolygonChange(null);
    }
  };

  // Expose the clear map function globally so it can be called from the sidebar
  window.mapClearFunction = handleClearMap;

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
          <Button
            variant="ghost"
            size="icon"
            title="Toggle Layers"
          >
            <Layers className="h-4 w-4" />
          </Button>
        </Card>
      </div>

      {/* Route Legend */}
      {showLegend && (
        <Card className="absolute bottom-4 left-4 route-legend p-4">
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

      {/* Coordinates Display */}
      <Card className="absolute bottom-4 right-4 px-3 py-2">
        <div className="text-sm text-gray-600">
          Lat: {mouseCoords.lat}, Lng: {mouseCoords.lng}
        </div>
      </Card>
    </div>
  );
}
