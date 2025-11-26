"use client";

import {
  Check,
  CheckCircle2,
  Download,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Settings,
  Sparkles,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ImageFormat, ResizeFit } from "@/lib/converter/types";
import { formatBytes } from "@/lib/utils";

interface ConversionResult {
  success: boolean;
  originalFilename: string;
  outputFilename?: string;
  downloadFilename?: string; // User-facing filename (original name + new extension)
  downloadUrl?: string;
  originalSize?: number;
  convertedSize?: number;
  reductionPercent?: number;
  error?: string;
}

interface ConversionStats {
  total: number;
  success: number;
  failed: number;
  totalOriginalSize: number;
  totalConvertedSize: number;
}

interface FileSettings {
  format: ImageFormat;
  quality: number;
  width?: number;
  height?: number;
  fit: ResizeFit;
}

interface FileWithSettings {
  file: File;
  settings: FileSettings;
  selected: boolean;
}

export default function Home() {
  const [files, setFiles] = useState<FileWithSettings[]>([]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modals for settings
  const [showIndividualSettings, setShowIndividualSettings] = useState<number | null>(null);
  const [showBulkSettings, setShowBulkSettings] = useState(false);

  // Default settings
  const [defaultSettings] = useState<FileSettings>({
    format: "webp",
    quality: 80,
    width: undefined,
    height: undefined,
    fit: "inside",
  });

  // Bulk settings with override flag
  const [bulkSettings, setBulkSettings] = useState<FileSettings>({
    ...defaultSettings,
  });
  const [overrideIndividual, setOverrideIndividual] = useState(true);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        file,
        settings: { ...defaultSettings },
        selected: false,
      }));
      setFiles(newFiles);
      setResults([]);
      setStats(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).map((file) => ({
        file,
        settings: { ...defaultSettings },
        selected: false,
      }));
      setFiles(newFiles);
      setResults([]);
      setStats(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const toggleFileSelection = (index: number) => {
    const newFiles = [...files];
    if (newFiles[index]) {
      newFiles[index].selected = !newFiles[index].selected;
      setFiles(newFiles);
    }
  };

  const selectAll = () => {
    setFiles(files.map((f) => ({ ...f, selected: true })));
  };

  const deselectAll = () => {
    setFiles(files.map((f) => ({ ...f, selected: false })));
  };

  const invertSelection = () => {
    setFiles(files.map((f) => ({ ...f, selected: !f.selected })));
  };

  const updateFileSettings = (index: number, settings: Partial<FileSettings>) => {
    const newFiles = [...files];
    if (newFiles[index]) {
      newFiles[index].settings = { ...newFiles[index].settings, ...settings };
      setFiles(newFiles);
    }
  };

  const applyBulkSettings = () => {
    const newFiles = files.map((f) => {
      if (f.selected) {
        if (overrideIndividual) {
          return { ...f, settings: { ...bulkSettings } };
        }
        // If not overriding, only apply to files that still have default settings
        const hasDefaultSettings = JSON.stringify(f.settings) === JSON.stringify(defaultSettings);
        if (hasDefaultSettings) {
          return { ...f, settings: { ...bulkSettings } };
        }
      }
      return f;
    });
    setFiles(newFiles);
    setShowBulkSettings(false);
  };

  const selectedCount = files.filter((f) => f.selected).length;

  const handleConvert = async () => {
    if (files.length === 0) return;

    console.log("[BROWSER] Starting conversion process", {
      fileCount: files.length,
      timestamp: new Date().toISOString(),
    });

    setConverting(true);
    setProgress(0);
    setResults([]);

    try {
      const formData = new FormData();

      // Add files with their individual settings
      for (const [index, fileWithSettings] of files.entries()) {
        formData.append("files", fileWithSettings.file);
        formData.append(`settings[${index}]`, JSON.stringify(fileWithSettings.settings));
        console.log("[BROWSER] Preparing file for upload", {
          filename: fileWithSettings.file.name,
          size: fileWithSettings.file.size,
          settings: fileWithSettings.settings,
        });
      }

      console.log("[BROWSER] Sending conversion request to server", {
        fileCount: files.length,
        endpoint: "/api/convert",
      });

      const requestStartTime = Date.now();
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const requestDuration = Date.now() - requestStartTime;
      console.log("[BROWSER] Received response from server", {
        status: response.status,
        duration: `${requestDuration}ms`,
      });

      if (!response.ok) {
        throw new Error("Conversion failed");
      }

      const data = await response.json();
      console.log("[BROWSER] Conversion completed", {
        successCount: data.stats?.success || 0,
        failedCount: data.stats?.failed || 0,
        totalSize: data.stats?.totalOriginalSize || 0,
        convertedSize: data.stats?.totalConvertedSize || 0,
        sessionId: data.sessionId,
      });

      setResults(data.results);
      setStats(data.stats);
      setProgress(100);
    } catch (error) {
      console.error("[BROWSER] Conversion error:", error);
      alert("Conversion failed. Please try again.");
    } finally {
      setConverting(false);
      console.log("[BROWSER] Conversion process finished");
    }
  };

  const handleDownloadAll = async () => {
    const successfulFiles = results
      .filter((r) => r.success && r.outputFilename)
      .map((r) => r.outputFilename as string);

    if (successfulFiles.length === 0) return;

    try {
      const response = await fetch("/api/download-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filenames: successfulFiles }),
      });

      if (!response.ok) throw new Error("Download failed");

      // Get filename from Content-Disposition header if possible
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "images.zip";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Bulk download failed:", error);
      alert("Bulk download failed. Please try again.");
    }
  };

  const handleReset = async () => {
    try {
      // Clear cache on server
      const response = await fetch("/api/cache/clear", {
        method: "POST",
      });

      if (!response.ok) {
        console.error("Failed to clear cache on server");
      }
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }

    // Reset all state
    setFiles([]);
    setResults([]);
    setStats(null);
    setProgress(0);
    setConverting(false);
    setShowIndividualSettings(null);
    setShowBulkSettings(false);
    setBulkSettings({ ...defaultSettings });
    setOverrideIndividual(true);

    // Reset file input
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Header with gradient */}
          <div className="space-y-6 text-center flex flex-col items-center justify-center pt-8 md:pt-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-fade-in">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Free & Secure</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-heading tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent max-w-3xl leading-tight">
              Image Converter
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Convert images to modern formats with advanced compression. Fast, secure, and
              privacy-focused.
            </p>
          </div>

          {/* Upload Section with enhanced design */}
          <Card className="border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5" />
                Upload Images
              </CardTitle>
              <CardDescription>
                Drag and drop your images or click to browse. Supports all major formats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  relative border-2 border-dashed rounded-xl p-8 md:p-12 text-center
                  transition-all duration-300 cursor-pointer group
                  ${
                    isDragging
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                  }
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById("file-input")?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    document.getElementById("file-input")?.click();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-4 group-hover:bg-primary/20 transition-colors">
                    <ImageIcon className="h-10 w-10 md:h-12 md:w-12 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg md:text-xl font-semibold mb-2">
                      {files.length > 0
                        ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
                        : "Drop images here or click to upload"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      SVG, PNG, JPG, GIF, WEBP, AVIF, HEIF, TIFF (max 50MB per file)
                    </p>
                  </div>
                </div>
                <input
                  id="file-input"
                  type="file"
                  multiple
                  accept="image/*,.svg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {files.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">Selected files</p>
                      <Badge variant="secondary">{files.length} files</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAll}
                        className="h-8 text-xs"
                      >
                        Select All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={invertSelection}
                        className="h-8 text-xs"
                      >
                        Invert
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={deselectAll}
                        className="h-8 text-xs"
                      >
                        Deselect All
                      </Button>
                      {selectedCount > 0 && (
                        <Button
                          size="sm"
                          onClick={() => setShowBulkSettings(true)}
                          className="h-8 text-xs"
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Bulk Options ({selectedCount})
                        </Button>
                      )}
                      {results.some((r) => r.success) && (
                        <Button size="sm" onClick={handleDownloadAll} className="h-8 text-xs">
                          <Download className="h-3 w-3 mr-1" />
                          Download All
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {files.map((fileWithSettings, index) => (
                      <div
                        key={`${fileWithSettings.file.name}-${index}`}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all group ${
                          fileWithSettings.selected
                            ? "bg-primary/10 border-2 border-primary/30"
                            : "bg-accent/50 hover:bg-accent border-2 border-transparent"
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleFileSelection(index)}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            fileWithSettings.selected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30 hover:border-primary"
                          }`}
                        >
                          {fileWithSettings.selected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </button>

                        {/* File icon */}
                        <div className="rounded-md bg-primary/10 p-2 flex-shrink-0">
                          <ImageIcon className="h-4 w-4 text-primary" />
                        </div>

                        {/* File info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fileWithSettings.file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(fileWithSettings.file.size)} →{" "}
                            {fileWithSettings.settings.format.toUpperCase()} (
                            {fileWithSettings.settings.quality}%)
                          </p>
                        </div>

                        {/* Options button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowIndividualSettings(index);
                          }}
                          className="flex-shrink-0"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>

                        {/* Remove button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Individual Settings Modal */}
          {showIndividualSettings !== null && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowIndividualSettings(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowIndividualSettings(null);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Card
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    File Settings
                  </CardTitle>
                  <CardDescription>
                    Configure settings for {files[showIndividualSettings]?.file.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Format */}
                    <div className="space-y-2">
                      <label
                        htmlFor={`format-${showIndividualSettings}`}
                        className="text-sm font-medium"
                      >
                        Output Format
                      </label>
                      <select
                        id={`format-${showIndividualSettings}`}
                        value={files[showIndividualSettings]?.settings.format}
                        onChange={(e) =>
                          updateFileSettings(showIndividualSettings, {
                            format: e.target.value as ImageFormat,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="webp">WebP</option>
                        <option value="avif">AVIF</option>
                        <option value="jpeg">JPEG</option>
                        <option value="png">PNG</option>
                        <option value="gif">GIF</option>
                        <option value="tiff">TIFF</option>
                        <option value="heif">HEIF</option>
                        <option value="jxl">JPEG XL</option>
                      </select>
                    </div>

                    {/* Quality */}
                    <div className="space-y-2">
                      <label
                        htmlFor={`quality-${showIndividualSettings}`}
                        className="text-sm font-medium"
                      >
                        Quality: {files[showIndividualSettings]?.settings.quality}%
                      </label>
                      <input
                        id={`quality-${showIndividualSettings}`}
                        type="range"
                        min="1"
                        max="100"
                        value={files[showIndividualSettings]?.settings.quality}
                        onChange={(e) =>
                          updateFileSettings(showIndividualSettings, {
                            quality: Number.parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Width */}
                    <div className="space-y-2">
                      <label
                        htmlFor={`width-${showIndividualSettings}`}
                        className="text-sm font-medium"
                      >
                        Width (optional)
                      </label>
                      <input
                        id={`width-${showIndividualSettings}`}
                        type="number"
                        placeholder="Auto"
                        value={files[showIndividualSettings]?.settings.width || ""}
                        onChange={(e) =>
                          updateFileSettings(showIndividualSettings, {
                            width: e.target.value ? Number.parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Height */}
                    <div className="space-y-2">
                      <label
                        htmlFor={`height-${showIndividualSettings}`}
                        className="text-sm font-medium"
                      >
                        Height (optional)
                      </label>
                      <input
                        id={`height-${showIndividualSettings}`}
                        type="number"
                        placeholder="Auto"
                        value={files[showIndividualSettings]?.settings.height || ""}
                        onChange={(e) =>
                          updateFileSettings(showIndividualSettings, {
                            height: e.target.value
                              ? Number.parseInt(e.target.value, 10)
                              : undefined,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Fit Mode */}
                    <div className="space-y-2 col-span-2">
                      <label
                        htmlFor={`fit-${showIndividualSettings}`}
                        className="text-sm font-medium"
                      >
                        Resize Mode
                      </label>
                      <select
                        id={`fit-${showIndividualSettings}`}
                        value={files[showIndividualSettings]?.settings.fit}
                        onChange={(e) =>
                          updateFileSettings(showIndividualSettings, {
                            fit: e.target.value as ResizeFit,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="inside">Inside (Preserve aspect ratio)</option>
                        <option value="outside">Outside (Preserve aspect ratio)</option>
                        <option value="cover">Cover (Crop to fit)</option>
                        <option value="contain">Contain (Fit within)</option>
                        <option value="fill">Fill (Stretch)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowIndividualSettings(null)}>
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Bulk Settings Modal */}
          {showBulkSettings && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowBulkSettings(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowBulkSettings(false);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Card
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Bulk Settings
                  </CardTitle>
                  <CardDescription>
                    Apply settings to {selectedCount} selected file
                    {selectedCount > 1 ? "s" : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Override checkbox */}
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setOverrideIndividual(!overrideIndividual)}
                      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        overrideIndividual
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30 hover:border-primary"
                      }`}
                    >
                      {overrideIndividual && <Check className="h-3 w-3 text-primary-foreground" />}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Override individual file settings</p>
                      <p className="text-xs text-muted-foreground">
                        Apply these settings even if files have custom settings
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Format */}
                    <div className="space-y-2">
                      <label htmlFor="bulk-format" className="text-sm font-medium">
                        Output Format
                      </label>
                      <select
                        id="bulk-format"
                        value={bulkSettings.format}
                        onChange={(e) =>
                          setBulkSettings({
                            ...bulkSettings,
                            format: e.target.value as ImageFormat,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="webp">WebP (Recommended)</option>
                        <option value="avif">AVIF (Best Compression)</option>
                        <option value="jpeg">JPEG</option>
                        <option value="png">PNG</option>
                        <option value="gif">GIF</option>
                        <option value="tiff">TIFF</option>
                        <option value="heif">HEIF</option>
                        <option value="jxl">JPEG XL</option>
                      </select>
                    </div>

                    {/* Quality */}
                    <div className="space-y-2">
                      <label htmlFor="bulk-quality" className="text-sm font-medium">
                        Quality: {bulkSettings.quality}%
                      </label>
                      <input
                        id="bulk-quality"
                        type="range"
                        min="1"
                        max="100"
                        value={bulkSettings.quality}
                        onChange={(e) =>
                          setBulkSettings({
                            ...bulkSettings,
                            quality: Number.parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    {/* Width */}
                    <div className="space-y-2">
                      <label htmlFor="bulk-width" className="text-sm font-medium">
                        Width (optional)
                      </label>
                      <input
                        id="bulk-width"
                        type="number"
                        placeholder="Auto"
                        value={bulkSettings.width || ""}
                        onChange={(e) =>
                          setBulkSettings({
                            ...bulkSettings,
                            width: e.target.value ? Number.parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Height */}
                    <div className="space-y-2">
                      <label htmlFor="bulk-height" className="text-sm font-medium">
                        Height (optional)
                      </label>
                      <input
                        id="bulk-height"
                        type="number"
                        placeholder="Auto"
                        value={bulkSettings.height || ""}
                        onChange={(e) =>
                          setBulkSettings({
                            ...bulkSettings,
                            height: e.target.value
                              ? Number.parseInt(e.target.value, 10)
                              : undefined,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    {/* Fit Mode */}
                    <div className="space-y-2 col-span-2">
                      <label htmlFor="bulk-fit" className="text-sm font-medium">
                        Resize Mode
                      </label>
                      <select
                        id="bulk-fit"
                        value={bulkSettings.fit}
                        onChange={(e) =>
                          setBulkSettings({
                            ...bulkSettings,
                            fit: e.target.value as ResizeFit,
                          })
                        }
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="inside">Inside (Preserve aspect ratio)</option>
                        <option value="outside">Outside (Preserve aspect ratio)</option>
                        <option value="cover">Cover (Crop to fit)</option>
                        <option value="contain">Contain (Fit within)</option>
                        <option value="fill">Fill (Stretch)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowBulkSettings(false)}>
                      Cancel
                    </Button>
                    <Button onClick={applyBulkSettings}>Apply Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Convert Button */}
          {files.length > 0 && (
            <Button
              onClick={handleConvert}
              disabled={converting}
              className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
              size="lg"
            >
              {converting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Convert {files.length} Image{files.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}

          {/* Progress */}
          {converting && (
            <Card className="border-2 shadow-lg">
              <CardContent className="pt-6">
                <Progress value={progress} className="w-full h-3" />
                <p className="text-sm text-center mt-3 text-muted-foreground font-medium">
                  Converting your images...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl">Conversion Results</CardTitle>
                    <CardDescription className="mt-1">
                      {stats && (
                        <>
                          <span className="font-semibold text-green-600">{stats.success}</span> of{" "}
                          <span className="font-semibold">{stats.total}</span> images converted
                          successfully
                          {stats.totalOriginalSize > 0 && stats.totalConvertedSize > 0 && (
                            <>
                              {" · "}
                              <span className="font-semibold text-primary">
                                Saved{" "}
                                {formatBytes(stats.totalOriginalSize - stats.totalConvertedSize)}
                              </span>{" "}
                              (
                              {(
                                (1 - stats.totalConvertedSize / stats.totalOriginalSize) *
                                100
                              ).toFixed(1)}
                              %)
                            </>
                          )}
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {stats && stats.success > 0 && (
                      <Button onClick={handleDownloadAll} size="lg" className="shadow-md">
                        <Download className="mr-2 h-4 w-4" />
                        Download All ({stats.success})
                      </Button>
                    )}
                    <Button onClick={handleReset} size="lg" variant="outline" className="shadow-md">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {results.map((result, index) => (
                    <div
                      key={`${result.originalFilename}-${index}`}
                      className="flex items-center justify-between p-4 bg-accent/50 hover:bg-accent rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {result.success ? (
                          <div className="rounded-full bg-green-500/10 p-2 flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          </div>
                        ) : (
                          <div className="rounded-full bg-red-500/10 p-2 flex-shrink-0">
                            <XCircle className="h-5 w-5 text-red-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.originalFilename}</p>
                          {result.success ? (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">
                                {result.originalSize && formatBytes(result.originalSize)}
                              </span>
                              {" → "}
                              <span className="font-medium">
                                {result.convertedSize && formatBytes(result.convertedSize)}
                              </span>
                              {result.reductionPercent !== undefined && (
                                <span
                                  className={`ml-2 font-semibold ${result.reductionPercent > 0 ? "text-green-600" : "text-orange-600"}`}
                                >
                                  ({result.reductionPercent > 0 ? "-" : "+"}
                                  {Math.abs(result.reductionPercent).toFixed(1)}%)
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-red-500 mt-1">{result.error}</p>
                          )}
                        </div>
                      </div>
                      {result.success && result.downloadUrl && (
                        <Button size="sm" variant="outline" asChild className="ml-2 flex-shrink-0">
                          <a
                            href={result.downloadUrl}
                            download={result.downloadFilename || result.outputFilename}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Features Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Fast & Secure</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All conversions happen on the server with enterprise-grade security. Files are
                  automatically deleted after 15 minutes.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Flexible Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Configure each file individually or apply bulk settings to multiple files. Full
                  control over your conversions.
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-2">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Advanced Options</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Fine-tune quality, dimensions, and compression settings for optimal results.
                  Support for all modern formats.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
