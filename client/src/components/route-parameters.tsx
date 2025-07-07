import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Settings, ChevronDown } from "lucide-react";
import { RouteParameters as RouteParametersType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface RouteParametersProps {
  parameters: RouteParametersType;
  onParametersChange: (parameters: RouteParametersType) => void;
}

export default function RouteParameters({
  parameters,
  onParametersChange,
}: RouteParametersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateParameter = (key: keyof RouteParametersType, value: number) => {
    onParametersChange({
      ...parameters,
      [key]: value,
    });
  };

  return (
    <Card className="border-0 border-b border-gray-100 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Route Parameters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Distance Input */}
        <div className="space-y-2">
          <Label htmlFor="distance">Transect Distance (meters)</Label>
          <div className="relative">
            <Input
              id="distance"
              type="number"
              value={parameters.distance}
              onChange={(e) => updateParameter("distance", Number(e.target.value))}
              placeholder="50"
              min="1"
              step="0.1"
              className="pr-8"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">m</span>
            </div>
          </div>
        </div>

        {/* Bearing Input */}
        <div className="space-y-2">
          <Label htmlFor="bearing">Bearing (degrees)</Label>
          <div className="relative">
            <Input
              id="bearing"
              type="number"
              value={parameters.bearing}
              onChange={(e) => updateParameter("bearing", Number(e.target.value))}
              placeholder="0"
              min="0"
              max="360"
              step="1"
              className="pr-8"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">°</span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            0° = North, 90° = East, 180° = South, 270° = West
          </p>
        </div>

        {/* Advanced Options */}
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-primary hover:text-primary/80 p-0"
          >
            <Settings className="h-4 w-4 mr-2" />
            Advanced Options
            <ChevronDown className={cn(
              "h-4 w-4 ml-1 transition-transform",
              showAdvanced && "rotate-180"
            )} />
          </Button>

          {showAdvanced && (
            <div className="mt-3 space-y-4">
              {/* Overlap Slider */}
              <div className="space-y-2">
                <Label>Overlap ({parameters.overlap}%)</Label>
                <Slider
                  value={[parameters.overlap]}
                  onValueChange={(value) => updateParameter("overlap", value[0])}
                  min={0}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0%</span>
                  <span>50%</span>
                </div>
              </div>

              {/* Turn Radius */}
              <div className="space-y-2">
                <Label htmlFor="turnRadius">Turn Radius (meters)</Label>
                <Input
                  id="turnRadius"
                  type="number"
                  value={parameters.turnRadius}
                  onChange={(e) => updateParameter("turnRadius", Number(e.target.value))}
                  placeholder="20"
                  min="1"
                  step="0.1"
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
