import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Save } from "lucide-react";

interface MapSettingsProps {
  onSettingsChange: (settings: { arcgisClientId: string }) => void;
}

export default function MapSettings({ onSettingsChange }: MapSettingsProps) {
  const [arcgisClientId, setArcgisClientId] = useState(
    localStorage.getItem('arcgis_client_id') || ''
  );
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSave = () => {
    localStorage.setItem('arcgis_client_id', arcgisClientId);
    onSettingsChange({ arcgisClientId });
    setIsExpanded(false);
  };

  return (
    <Card className="mx-6 mb-4">
      <CardHeader 
        className="cursor-pointer" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings className="h-4 w-4" />
          Map Settings
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="arcgis-client-id" className="text-sm font-medium">
              ArcGIS OAuth App ID
            </Label>
            <Input
              id="arcgis-client-id"
              placeholder="Enter your ArcGIS OAuth App ID"
              value={arcgisClientId}
              onChange={(e) => setArcgisClientId(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-gray-500">
              Required to access secure map layers. Get this from your ArcGIS Developers account.
            </p>
            <div className="p-2 bg-blue-50 rounded text-xs text-blue-800">
              <strong>Redirect URI to configure:</strong>
              <br />
              <code className="bg-white px-1 py-0.5 rounded text-xs">
                {window.location.origin + window.location.pathname}
              </code>
            </div>
          </div>
          
          <Button 
            onClick={handleSave}
            size="sm"
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </Button>
        </CardContent>
      )}
    </Card>
  );
}