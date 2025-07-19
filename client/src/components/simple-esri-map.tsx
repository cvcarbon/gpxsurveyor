import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2, Menu } from "lucide-react";

interface SimpleEsriMapProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  generatedRoute: any;
  sidebarOpen: boolean;
  onToggleSidebar?: () => void;
}

declare global {
  interface Window {
    require: any;
  }
}

export default function SimpleEsriMap({
  polygon,
  onPolygonChange,
  generatedRoute,
  sidebarOpen,
  onToggleSidebar,
}: SimpleEsriMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapView, setMapView] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    // Wait for Esri API to be available
    const checkAndInitialize = () => {
      if (typeof window.require !== 'undefined') {
        initializeMap();
      } else {
        setTimeout(checkAndInitialize, 100);
      }
    };

    const initializeMap = () => {
      window.require([
        "esri/Map",
        "esri/views/MapView"
      ], (Map: any, MapView: any) => {
        try {
          const map = new Map({
            basemap: "satellite"
          });

          const view = new MapView({
            container: mapRef.current,
            map: map,
            center: [-94.7977, 29.3013], // Galveston Bay, TX
            zoom: 12
          });

          view.when(() => {
            console.log("Simple Esri map loaded");
            setMapView(view);
          }).catch((error: any) => {
            console.error("Map initialization failed:", error);
          });

        } catch (error) {
          console.error("Error creating map:", error);
        }
      });
    };

    checkAndInitialize();

    return () => {
      if (mapView) {
        mapView.destroy();
      }
    };
  }, []);

  const handleClearMap = () => {
    onPolygonChange(null);
  };

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div
        ref={mapRef}
        className="h-full w-full"
        style={{ 
          height: "100vh",
          width: "100%"
        }}
      />

      {/* Sidebar Toggle Button */}
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

      {/* Simple Controls */}
      <div className="absolute top-4 right-4">
        <Card className="p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearMap}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </Card>
      </div>

      {/* Status Message */}
      <div className="absolute bottom-4 left-4">
        <Card className="p-3">
          <div className="text-sm">
            {mapView ? "Map Ready" : "Loading Map..."}
          </div>
        </Card>
      </div>
    </div>
  );
}