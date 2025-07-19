import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CloudUpload, FileText, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, apiFormDataRequest } from "@/lib/queryClient";

interface PolygonInputProps {
  polygon: any;
  onPolygonChange: (polygon: any) => void;
  onError: (error: string) => void;
  onStartDrawing?: () => void;
  onClearMap?: () => void;
}

export default function PolygonInput({
  polygon,
  onPolygonChange,
  onError,
  onStartDrawing,
  onClearMap,
}: PolygonInputProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "draw">("draw");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList) => {
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const response = await apiFormDataRequest("POST", "/api/upload-polygon", formData);
      const result = await response.json();

      if (result.polygons && result.polygons.length > 0) {
        setUploadedFiles(result.files || []);
        onPolygonChange(result.polygons[0]); // Use first polygon
      } else {
        onError("No valid polygons found in uploaded files");
      }
    } catch (error) {
      console.error("File upload error:", error);
      onError("Failed to upload and process files: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
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
    // Call the map clear function if available
    if (onClearMap) {
      onClearMap();
    } else if ((window as any).mapClearFunction) {
      (window as any).mapClearFunction();
    }
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
            variant={activeTab === "draw" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("draw")}
            className="flex-1"
          >
            Draw Polygon
          </Button>
          <Button
            variant={activeTab === "upload" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("upload")}
            className="flex-1"
          >
            Upload File
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
              <div className="flex items-center mb-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
                <p className="text-sm text-blue-700 font-medium">
                  Drawing Instructions:
                </p>
              </div>
              <div className="text-sm text-blue-600 space-y-1">
                <p>1. Click "Start Drawing" button below</p>
                <p>2. Click the polygon tool that appears in the top-left</p>
                <p>3. Click points on the map to draw your survey area</p>
                <p>4. Click the first point again to complete the polygon</p>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="default"
                size="sm"
                onClick={onStartDrawing}
                disabled={!onStartDrawing}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Start Drawing
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearPolygon}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>

            {polygon && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-700">
                  ✓ Polygon ready! You can now generate a route.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
