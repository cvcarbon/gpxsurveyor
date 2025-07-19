import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Menu } from "lucide-react";

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

  useEffect(() => {
    let view: any = null;

    const initializeMap = async () => {
      if (!mapRef.current) return;

      try {
        // Wait for Esri to be available
        if (typeof (window as any).require === 'undefined') {
          throw new Error('Esri API not loaded');
        }

        const [Map, MapView] = await new Promise((resolve, reject) => {
          (window as any).require([
            "esri/Map",
            "esri/views/MapView"
          ], (...modules: any[]) => {
            resolve(modules);
          }, (error: any) => {
            reject(error);
          });
        });

        const map = new (Map as any)({
          basemap: "streets-navigation-vector"
        });

        view = new (MapView as any)({
          container: mapRef.current,
          map: map,
          center: [-94.7977, 29.3013], // Galveston Bay, TX
          zoom: 11
        });

        await view.when();
        console.log("Basic map initialized successfully");
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

  const handleClear = () => {
    onPolygonChange(null);
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
          <Card className="p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="text-red-600 hover:text-red-700"
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
          {polygon && (
            <div className="text-xs text-gray-600 mt-1">
              Polygon loaded
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}