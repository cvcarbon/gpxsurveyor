import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Eye, EyeOff, AlertCircle } from "lucide-react";

interface EsriLayer {
  id: string;
  name: string;
  url: string;
  visible: boolean;
  authenticated: boolean;
  error?: string;
}

interface EsriLayersControlProps {
  onLayersChange: (layers: EsriLayer[]) => void;
}

// Default Esri REST services
const DEFAULT_LAYERS: Omit<EsriLayer, 'authenticated' | 'visible'>[] = [
  {
    id: "lease-boundaries",
    name: "Lease Boundaries",
    url: "https://gis.bsee.gov/arcgis/rest/services/BOEM_BSEE/Lease_Blocks_Federal_Waters/MapServer"
  },
  {
    id: "bedding-documentation",
    name: "Bedding Documentation",
    url: "https://gis.bsee.gov/arcgis/rest/services/BOEM_BSEE/Infrastructure/MapServer"
  }
];

export default function EsriLayersControl({ onLayersChange }: EsriLayersControlProps) {
  const [layers, setLayers] = useState<EsriLayer[]>([]);

  // Initialize with default layers
  useEffect(() => {
    const initialLayers = DEFAULT_LAYERS.map(layer => ({
      ...layer,
      visible: false,
      authenticated: false
    }));
    setLayers(initialLayers);
    console.log("Loading default Esri layers:", initialLayers.map(l => l.name));
  }, []);

  useEffect(() => {
    onLayersChange(layers);
    console.log("Esri layers changed:", layers.filter(l => l.visible).map(l => l.name));
  }, [layers, onLayersChange]);

  const toggleLayerVisibility = (id: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    ));
  };

  const updateLayerAuth = (id: string, authenticated: boolean, error?: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, authenticated, error } : layer
    ));
  };

  return (
    <Card className="border-0 border-b border-gray-100 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Map Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Available Layers</Label>
          {layers.map((layer) => (
            <div
              key={layer.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3 flex-1">
                <Switch
                  checked={layer.visible}
                  onCheckedChange={() => toggleLayerVisibility(layer.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {layer.name}
                    </span>
                    {layer.visible && layer.authenticated ? (
                      <Badge variant="default" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    ) : layer.visible && !layer.authenticated ? (
                      <Badge variant="secondary" className="text-xs">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Loading
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    BOEM/BSEE Federal Waters
                  </p>
                  {layer.error && (
                    <p className="text-xs text-red-500">{layer.error}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-700 mb-1">Authentication Notice</p>
              <p>These layers may require BOEM/BSEE account authentication. Your browser will prompt for login when needed.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}