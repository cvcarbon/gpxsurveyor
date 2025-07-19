import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, X } from "lucide-react";
import PolygonInput from "./polygon-input";
import RouteParameters from "./route-parameters";
import RouteGeneration from "./route-generation";
import ExportOptions from "./export-options";
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
      "h-full w-full bg-white shadow-xl border-r border-gray-200 flex flex-col",
      "md:w-96", // Fixed width on desktop
      open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
    )}>
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900">GPX Surveyor</h1>
            <p className="text-xs md:text-sm text-gray-500">Autopilot Route Generator</p>
          </div>
          
          <Button
            variant="ghost" 
            size="sm"
            onClick={onToggle}
            className="md:hidden p-2 touch-manipulation min-h-[44px] min-w-[44px]"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain mobile-scroll">
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
