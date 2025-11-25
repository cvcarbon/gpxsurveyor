import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ArcGISTest() {
  const [testResult, setTestResult] = useState<string>("");
  
  const testArcGISConnection = async () => {
    try {
      setTestResult("Testing ArcGIS connection...");
      
      // Test basic ArcGIS API loading (esri-leaflet)
      const Esri = await import("esri-leaflet");
      setTestResult("✓ esri-leaflet loaded successfully");
      
      // Test feature layer access without authentication
      const { query } = Esri;
      
      const url = "https://services.arcgis.com/W1AXaDPef2QMa9kU/arcgis/rest/services/Lease_Boundaries_Leasee_View/FeatureServer/0";
      
      setTestResult("Querying feature layer...");
      
      const count = await new Promise((resolve, reject) => {
        query({ url })
          .count((error, count) => {
            if (error) {
              reject(error);
            } else {
              resolve(count);
            }
          });
      });
      
      setTestResult(`✓ Feature layer accessed successfully (Count: ${count})`);
      
    } catch (error: any) {
      console.error("ArcGIS test failed:", error);
      setTestResult(`❌ Test failed: ${error.message}`);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>ArcGIS Connection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testArcGISConnection}>
          Test ArcGIS Connection
        </Button>
        {testResult && (
          <div className="text-sm p-2 bg-gray-100 rounded">
            {testResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
