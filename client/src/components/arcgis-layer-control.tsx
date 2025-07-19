import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useArcGISAuth } from "@/lib/arcgis-auth";
import { Layers, Eye, EyeOff } from "lucide-react";

interface ArcGISLayerControlProps {
  onLayerToggle: (layerUrl: string, visible: boolean) => void;
  layerVisibility: Record<string, boolean>;
}

export default function ArcGISLayerControl({ 
  onLayerToggle, 
  layerVisibility 
}: ArcGISLayerControlProps) {
  const { isAuthenticated } = useArcGISAuth();
  
  const leaseLayerUrl = "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Lease_Boundaries_Leasee_View/FeatureServer/0";
  
  const isLayerVisible = layerVisibility[leaseLayerUrl] || false;

  const handleToggleLayer = (visible: boolean) => {
    onLayerToggle(leaseLayerUrl, visible);
  };

  // Remove authentication requirement since the layer works without it
  // if (!isAuthenticated) {
  //   return (
  //     <Card className="opacity-50">
  //       <CardHeader>
  //         <CardTitle className="flex items-center gap-2 text-sm">
  //           <Layers className="h-4 w-4" />
  //           ArcGIS Layers
  //         </CardTitle>
  //       </CardHeader>
  //       <CardContent>
  //         <p className="text-sm text-muted-foreground">
  //           Sign in to ArcGIS to access layers
  //         </p>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          ArcGIS Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="lease-boundaries" className="text-sm">
            Lease Boundaries
          </Label>
          <div className="flex items-center gap-2">
            {isLayerVisible ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-400" />
            )}
            <Switch
              id="lease-boundaries"
              checked={isLayerVisible}
              onCheckedChange={handleToggleLayer}
            />
          </div>
        </div>
        
        {isLayerVisible && (
          <div className="text-xs text-muted-foreground">
            Displaying lease boundaries from ArcGIS feature service
          </div>
        )}
      </CardContent>
    </Card>
  );
}