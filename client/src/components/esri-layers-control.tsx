import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Eye, EyeOff, Plus, Trash2 } from "lucide-react";

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

export default function EsriLayersControl({ onLayersChange }: EsriLayersControlProps) {
  const [layers, setLayers] = useState<EsriLayer[]>([]);
  const [newLayerUrl, setNewLayerUrl] = useState("");
  const [newLayerName, setNewLayerName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    onLayersChange(layers);
  }, [layers, onLayersChange]);

  const addLayer = () => {
    if (!newLayerUrl.trim() || !newLayerName.trim()) return;

    const newLayer: EsriLayer = {
      id: Date.now().toString(),
      name: newLayerName.trim(),
      url: newLayerUrl.trim(),
      visible: true,
      authenticated: false,
    };

    setLayers(prev => [...prev, newLayer]);
    setNewLayerUrl("");
    setNewLayerName("");
    setIsAdding(false);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(layer => layer.id !== id));
  };

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
          Esri Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Layer */}
        <div className="space-y-3">
          {!isAdding ? (
            <Button
              onClick={() => setIsAdding(true)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Esri REST Service
            </Button>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Layer name (e.g., 'Lease Boundaries')"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
              />
              <Input
                placeholder="Esri REST URL"
                value={newLayerUrl}
                onChange={(e) => setNewLayerUrl(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  onClick={addLayer}
                  size="sm"
                  disabled={!newLayerUrl.trim() || !newLayerName.trim()}
                >
                  Add Layer
                </Button>
                <Button
                  onClick={() => {
                    setIsAdding(false);
                    setNewLayerUrl("");
                    setNewLayerName("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Layer List */}
        {layers.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Layers</Label>
            {layers.map((layer) => (
              <div
                key={layer.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1">
                  <Switch
                    checked={layer.visible}
                    onCheckedChange={() => toggleLayerVisibility(layer.id)}
                    disabled={!layer.authenticated}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {layer.name}
                      </span>
                      {layer.authenticated ? (
                        <Badge variant="default" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Auth Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {layer.url}
                    </p>
                    {layer.error && (
                      <p className="text-xs text-red-500">{layer.error}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLayer(layer.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {layers.length === 0 && !isAdding && (
          <div className="text-center py-6 text-gray-500">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No Esri layers added yet</p>
            <p className="text-xs">Add REST service URLs to display data layers</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}