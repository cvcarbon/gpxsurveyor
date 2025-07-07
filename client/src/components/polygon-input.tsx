import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CloudUpload, FileText, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface PolygonInputProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  onError: (error: string) => void;
}

export default function PolygonInput({
  polygon,
  onPolygonChange,
  onError,
}: PolygonInputProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "draw">("upload");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList) => {
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await apiRequest("POST", "/api/upload-polygon", formData);
      const result = await response.json();

      if (result.polygons && result.polygons.length > 0) {
        setUploadedFiles(result.files);
        onPolygonChange(result.polygons[0]); // Use first polygon
      }
    } catch (error) {
      onError("Failed to upload and process files");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    if (newFiles.length === 0) {
      onPolygonChange(null);
    }
  };

  const clearPolygon = () => {
    onPolygonChange(null);
    setUploadedFiles([]);
  };

  const createTestPolygon = () => {
    // Create a simple rectangular test polygon (centered around NYC)
    const testPolygon = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-74.02, 40.71], // Southwest corner
          [-74.00, 40.71], // Southeast corner  
          [-74.00, 40.73], // Northeast corner
          [-74.02, 40.73], // Northwest corner
          [-74.02, 40.71]  // Close the polygon
        ]]
      },
      properties: {}
    };
    onPolygonChange(testPolygon);
  };

  return (
    <Card className="border-0 border-b border-gray-100 rounded-none">
      <CardHeader>
        <CardTitle className="text-lg">Define Area</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab Toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          <Button
            variant={activeTab === "upload" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("upload")}
            className="flex-1"
          >
            Upload File
          </Button>
          <Button
            variant={activeTab === "draw" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("draw")}
            className="flex-1"
          >
            Draw Polygon
          </Button>
        </div>

        {/* Upload Section */}
        {activeTab === "upload" && (
          <div className="space-y-4">
            <div
              className={cn(
                "file-upload-area rounded-lg p-6 text-center cursor-pointer transition-all",
                isDragOver && "drag-over"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudUpload className="h-8 w-8 text-gray-400 mb-2 mx-auto" />
              <p className="text-sm font-medium text-gray-700">
                Drop KML or SHP files here
              </p>
              <p className="text-xs text-gray-500 mt-1">or click to browse</p>
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".kml,.shp,.zip"
                multiple
                onChange={handleFileInputChange}
              />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">
                        {file.fileName}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Draw Section */}
        {activeTab === "draw" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                <p className="text-sm text-blue-700">
                  Click on the map to start drawing a polygon, or use the test polygon below
                </p>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                className="flex-1" 
                size="sm"
                onClick={createTestPolygon}
                variant="outline"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Test Polygon
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearPolygon}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
