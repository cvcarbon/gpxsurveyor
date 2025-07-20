import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, X } from "lucide-react";
import PolygonInput from "./polygon-input";
import RouteParameters from "./route-parameters";
import RouteGeneration from "./route-generation";
import ExportOptions from "./export-options";
import ArcGISSignIn from "./arcgis-signin";
import ArcGISLayerControl from "./arcgis-layer-control";

import { RouteParameters as RouteParametersType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  routeParameters: RouteParametersType;
  onParametersChange: (parameters: RouteParametersType) => void;
  generatedRoute: any;
  isGenerating: boolean;
  onRouteGenerated: (route: any) => void;
  onError: (error: string) => void;
  onLayerToggle?: (layerUrl: string, visible: boolean) => void;
  layerVisibility?: Record<string, boolean>;
}

export default function Sidebar({
  open,
  onToggle,
  polygon,
  onPolygonChange,
  routeParameters,
  onParametersChange,
  generatedRoute,
  isGenerating,
  onRouteGenerated,
  onError,
  onLayerToggle,
  layerVisibility = {},
}: SidebarProps) {
  return (
    <div className={cn(
      "w-96 bg-white shadow-xl border-r border-gray-200 flex flex-col transition-transform duration-300",
      "fixed left-0 top-0 h-full z-40 md:relative md:z-auto md:transform-none",
      !open && "-translate-x-full md:translate-x-0"
    )}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">GPX Surveyor</h1>
            <p className="text-sm text-gray-500">Autopilot Route Generator</p>
          </div>
          <div className="flex items-center gap-2">
            <ArcGISSignIn />
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="md:hidden"
              title="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* ArcGIS layers panel hidden per user request */}
        </div>
        
        <PolygonInput
          polygon={polygon}
          onPolygonChange={onPolygonChange}
          onError={onError}
        />
        
        <RouteParameters
          parameters={routeParameters}
          onParametersChange={onParametersChange}
        />
        
        <RouteGeneration
          polygon={polygon}
          parameters={routeParameters}
          generatedRoute={generatedRoute}
          isGenerating={isGenerating}
          onRouteGenerated={onRouteGenerated}
          onError={onError}
        />
        
        <ExportOptions
          generatedRoute={generatedRoute}
          onError={onError}
        />
      </div>
    </div>
  );
}
