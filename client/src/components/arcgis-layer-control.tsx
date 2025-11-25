import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useArcGISAuth, LEASE_LAYER_ADMIN, LEASE_LAYER_PUBLIC, BEDDING_LAYER_URL } from "@/lib/arcgis-auth";
import { Layers, Eye, EyeOff, Shield } from "lucide-react";

interface ArcGISLayerControlProps {
  onLayerToggle: (layerUrl: string, visible: boolean) => void;
  layerVisibility: Record<string, boolean>;
}

export default function ArcGISLayerControl({ 
  onLayerToggle, 
  layerVisibility 
}: ArcGISLayerControlProps) {
  const { isAuthenticated, isAdmin } = useArcGISAuth();
  
  // Use admin layer if user has admin access, otherwise use public view
  const leaseLayerUrl = isAdmin ? LEASE_LAYER_ADMIN : LEASE_LAYER_PUBLIC;
  const beddingLayerUrl = BEDDING_LAYER_URL;
  
  // Check visibility for both possible lease layer URLs (in case user signs in/out)
  const isLeaseLayerVisible = layerVisibility[LEASE_LAYER_ADMIN] || layerVisibility[LEASE_LAYER_PUBLIC] || false;
  const isBeddingLayerVisible = layerVisibility[beddingLayerUrl] || false;

  const handleToggleLeaseLayer = (visible: boolean) => {
    // Turn off both layers first to handle switching between admin/public
    if (layerVisibility[LEASE_LAYER_ADMIN]) {
      onLayerToggle(LEASE_LAYER_ADMIN, false);
    }
    if (layerVisibility[LEASE_LAYER_PUBLIC]) {
      onLayerToggle(LEASE_LAYER_PUBLIC, false);
    }
    
    // Then turn on the appropriate layer
    if (visible) {
      onLayerToggle(leaseLayerUrl, true);
    }
  };

  const handleToggleBeddingLayer = (visible: boolean) => {
    onLayerToggle(beddingLayerUrl, visible);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          ArcGIS Layers
          {isAdmin && (
            <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 font-normal">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <Label htmlFor="lease-boundaries" className="text-sm">
              Lease Boundaries
            </Label>
            {isAdmin && (
              <span className="text-xs text-amber-600">Full layer (all leases)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLeaseLayerVisible ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-400" />
            )}
            <Switch
              id="lease-boundaries"
              checked={isLeaseLayerVisible}
              onCheckedChange={handleToggleLeaseLayer}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <Label htmlFor="bedding-documentation" className="text-sm">
            Bedding Documentation
          </Label>
          <div className="flex items-center gap-2">
            {isBeddingLayerVisible ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-400" />
            )}
            <Switch
              id="bedding-documentation"
              checked={isBeddingLayerVisible}
              onCheckedChange={handleToggleBeddingLayer}
            />
          </div>
        </div>
        
        {(isLeaseLayerVisible || isBeddingLayerVisible) && (
          <div className="text-xs text-muted-foreground">
            Displaying {isLeaseLayerVisible && isBeddingLayerVisible ? 'both layers' : isLeaseLayerVisible ? 'lease boundaries' : 'bedding documentation'} from ArcGIS
          </div>
        )}
      </CardContent>
    </Card>
  );
}
