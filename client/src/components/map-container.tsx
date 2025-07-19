import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Expand, Trash2, Layers, ZoomIn, ZoomOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useArcGISAuth } from "@/lib/arcgis-auth";

interface MapContainerProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  generatedRoute: any;
  sidebarOpen: boolean;
  drawingMode?: boolean;
  onDrawingModeChange?: (mode: boolean) => void;
  onToggleSidebar?: () => void;
  arcgisLayers?: Record<string, boolean>;
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
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
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

  // Handle ArcGIS layers - no authentication required since test worked
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    Object.entries(arcgisLayers).forEach(async ([layerUrl, visible]) => {
      if (visible && !arcgisLayersRef.current[layerUrl]) {
        // Add ArcGIS layer
        try {
          const FeatureLayer = (await import("@arcgis/core/layers/FeatureLayer")).default;
          
          const featureLayer = new FeatureLayer({
            url: layerUrl,
            outFields: ["*"],
            popupTemplate: {
              title: "Lease Boundary",
              content: [
                {
                  type: "fields",
                  fieldInfos: [
                    {
                      fieldName: "OBJECTID",
                      label: "Object ID"
                    }
                  ]
                }
              ]
            }
          });

          await featureLayer.load();
          
          // Convert ArcGIS layer to Leaflet-compatible GeoJSON
          const query = featureLayer.createQuery();
          query.outFields = ["*"];
          query.returnGeometry = true;
          
          const featureSet = await featureLayer.queryFeatures(query);
          
          import("leaflet").then((L) => {
            console.log("Raw feature set:", featureSet);
            console.log("Features count:", featureSet.features.length);
            console.log("First feature:", featureSet.features[0]);
            
            // Try using the built-in toJSON method first
            try {
              const geoJsonData = featureSet.toJSON();
              console.log("FeatureSet toJSON result:", geoJsonData);
              
              if (geoJsonData && geoJsonData.features) {
                const geoJsonLayer = L.geoJSON(geoJsonData, {
                  style: {
                    color: '#ff6b35',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: '#ff6b35',
                    fillOpacity: 0.3
                  },
                  onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                      const popupContent = Object.entries(feature.properties)
                        .filter(([key, value]) => value !== null && value !== undefined)
                        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                        .join('<br>');
                      layer.bindPopup(popupContent);
                    }
                  }
                });
                
                arcgisLayersRef.current[layerUrl] = geoJsonLayer;
                geoJsonLayer.addTo(mapInstanceRef.current);
                return;
              }
            } catch (error) {
              console.error("Error with toJSON method:", error);
            }
            
            // Manual conversion fallback
            try {
              const geoJsonFeatures = [];
              
              featureSet.features.forEach((feature, index) => {
                try {
                  if (feature.geometry) {
                    // Get the geometry as JSON and validate it
                    const geometryJson = feature.geometry.toJSON();
                    
                    // Log first few geometries to understand structure
                    if (index < 3) {
                      console.log(`Sample geometry ${index}:`, geometryJson);
                    }
                    
                    // Validate that it has required GeoJSON properties
                    if (geometryJson && geometryJson.type && geometryJson.coordinates) {
                      const geoJsonFeature = {
                        type: "Feature",
                        geometry: geometryJson,
                        properties: feature.attributes || {}
                      };
                      geoJsonFeatures.push(geoJsonFeature);
                    } else {
                      console.warn(`Invalid geometry for feature ${index}:`, geometryJson);
                    }
                  }
                } catch (featureError) {
                  console.error(`Error processing feature ${index}:`, featureError);
                }
              });
              
              if (geoJsonFeatures.length > 0) {
                console.log(`Successfully converted ${geoJsonFeatures.length} features`);
                console.log("Sample converted feature:", geoJsonFeatures[0]);
                
                const geoJsonCollection = {
                  type: "FeatureCollection",
                  features: geoJsonFeatures
                };
                
                // Validate the collection structure
                const isValidCollection = geoJsonCollection.type === "FeatureCollection" && 
                                        Array.isArray(geoJsonCollection.features) &&
                                        geoJsonFeatures.every(f => f.type === "Feature" && f.geometry && f.properties);
                
                console.log("Collection is valid:", isValidCollection);
                
                if (!isValidCollection) {
                  console.error("Invalid GeoJSON collection structure");
                  return;
                }
                
                const geoJsonLayer = L.geoJSON(geoJsonCollection, {
                  style: {
                    color: '#ff6b35',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: '#ff6b35',
                    fillOpacity: 0.3
                  },
                  onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                      const popupContent = Object.entries(feature.properties)
                        .filter(([key, value]) => value !== null && value !== undefined)
                        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                        .join('<br>');
                      layer.bindPopup(popupContent);
                    }
                  }
                });
                
                arcgisLayersRef.current[layerUrl] = geoJsonLayer;
                geoJsonLayer.addTo(mapInstanceRef.current);
              } else {
                console.error("No valid features found");
              }
            } catch (error) {
              console.error("Manual conversion failed:", error);
            }
          });

        } catch (error) {
          console.error("Error adding ArcGIS layer:", error);
        }
      } else if (!visible && arcgisLayersRef.current[layerUrl]) {
        // Remove ArcGIS layer
        mapInstanceRef.current.removeLayer(arcgisLayersRef.current[layerUrl]);
        delete arcgisLayersRef.current[layerUrl];
      }
    });
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
