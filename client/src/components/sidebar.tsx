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
  onStartDrawing?: () => void;
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
  onStartDrawing,
}: SidebarProps) {
  return (
    <div className={cn(
      "sidebar-transition w-96 bg-white shadow-xl border-r border-gray-200 flex flex-col",
      !open && "-translate-x-full"
    )}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">GPX Surveyor</h1>
            <p className="text-sm text-gray-500">Autopilot Route Generator</p>
          </div>

        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <PolygonInput
          polygon={polygon}
          onPolygonChange={onPolygonChange}
          onError={onError}
          onStartDrawing={onStartDrawing}
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
