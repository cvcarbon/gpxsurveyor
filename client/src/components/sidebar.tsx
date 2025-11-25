import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, X } from "lucide-react";
import PolygonInput from "./polygon-input";
import RouteParameters from "./route-parameters";
import RouteGeneration from "./route-generation";
import ExportOptions from "./export-options";
import ArcGISSignIn from "./arcgis-signin";

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
}: SidebarProps) {
  return (
    <div className={cn(
      "w-96 bg-white shadow-xl border-r border-gray-200 flex flex-col transition-transform duration-300",
      "fixed left-0 top-0 h-full z-[9998] md:relative md:z-auto",
      // Desktop: always visible (md:translate-x-0)
      // Mobile: show/hide based on open state
      open 
        ? "translate-x-0 md:translate-x-0" 
        : "-translate-x-full md:translate-x-0"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="CV Carbon" className="h-12 w-auto" />
            <div>
              <p className="text-xs text-gray-500">Survey Route Generator</p>
            </div>
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
