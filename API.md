# Image Converter API Documentation

## Overview

The Image Converter API provides endpoints for uploading, converting, and downloading images. All files are automatically deleted after 15 minutes for security and privacy.

**Base URL**: `http://localhost:3000/api` (development)

---

## Authentication

No authentication required. The API is free and open to use.

---

## Endpoints

### 1. Get API Information

Get supported formats and default options.

**Endpoint**: `GET /api/convert`

**Response**:
```json
{
  "supportedInputFormats": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".tiff", ".tif", ".avif", ".heif", ".heic", ".jxl", ".bmp"],
  "supportedOutputFormats": ["jpeg", "png", "webp", "avif", "tiff", "gif", "heif", "jxl"],
  "defaultOptions": {
    "format": "webp",
    "quality": 80,
    "fit": "inside"
  },
  "limits": {
    "maxFileSize": "50MB",
    "maxFiles": 50
  }
}
```

---

### 2. Convert Images

Upload and convert one or more images.

**Endpoint**: `POST /api/convert`

**Content-Type**: `multipart/form-data`

**Request Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `files` | File[] | Yes | - | One or more image files to convert |
| `format` | string | No | "webp" | Output format: jpeg, png, webp, avif, tiff, gif, heif, jxl |
| `quality` | number | No | 80 | Image quality (1-100) |
| `width` | number | No | auto | Target width in pixels |
| `height` | number | No | auto | Target height in pixels |
| `fit` | string | No | "inside" | Resize mode: cover, contain, fill, inside, outside |

**Example Request (cURL)**:
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "files=@image1.jpg" \
  -F "files=@image2.png" \
  -F "format=webp" \
  -F "quality=85" \
  -F "width=800"
```

**Example Request (JavaScript)**:
```javascript
const formData = new FormData();
formData.append("files", fileInput.files[0]);
formData.append("files", fileInput.files[1]);
formData.append("format", "webp");
formData.append("quality", "85");
formData.append("width", "800");

const response = await fetch("/api/convert", {
  method: "POST",
  body: formData,
});

const result = await response.json();
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "originalFilename": "photo.jpg",
      "outputFilename": "1234567890-abc123-photo.webp",
      "downloadUrl": "/api/download/1234567890-abc123-photo.webp",
      "originalSize": 524288,
      "convertedSize": 98304,
      "reductionPercent": 81.25
    },
    {
      "success": false,
      "originalFilename": "corrupt.jpg",
      "error": "Input file contains unsupported image format"
    }
  ],
  "stats": {
    "total": 2,
    "success": 1,
    "failed": 1,
    "totalOriginalSize": 524288,
    "totalConvertedSize": 98304
  }
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "No files uploaded"
}
```

**Error Response** (500 Internal Server Error):
```json
{
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

---

### 3. Download Converted Image

Download a converted image file by filename.

**Endpoint**: `GET /api/download/{filename}`

**Path Parameters**:
- `filename` (string, required): The output filename from the conversion result

**Example Request**:
```bash
curl -O http://localhost:3000/api/download/1234567890-abc123-photo.webp
```

**Success Response** (200 OK):
- **Content-Type**: `image/webp` (or appropriate image MIME type)
- **Content-Disposition**: `attachment; filename="1234567890-abc123-photo.webp"`
- **Cache-Control**: `public, max-age=900` (15 minutes)
- **Body**: Binary image data

**Error Response** (404 Not Found):
```json
{
  "error": "File not found or expired"
}
```

**Error Response** (410 Gone):
```json
{
  "error": "File has expired"
}
```

Files older than 15 minutes return a 410 Gone status.

---

## Resize Modes

The `fit` parameter controls how images are resized:

| Mode | Description |
|------|-------------|
| `inside` | **(Default)** Preserve aspect ratio, fit within dimensions |
| `outside` | Preserve aspect ratio, resize to cover dimensions |
| `cover` | Crop to cover both dimensions (may crop image) |
| `contain` | Preserve aspect ratio, contain within dimensions (may add borders) |
| `fill` | Ignore aspect ratio, stretch to fill dimensions |

---

## Format-Specific Notes

### WebP (Recommended)
- Best balance of quality and file size
- Widely supported in modern browsers
- Good for web use

### AVIF
- Best compression (smallest files)
- Newer format with growing browser support
- Slightly slower conversion

### JPEG
- Universal compatibility
- Lossy compression
- No transparency support

### PNG
- Lossless compression
- Transparency support
- Larger file sizes

### SVG → Raster Conversion
- SVG files are rasterized at the requested dimensions
- No size limits for SVG conversion (vector format)
- Always outputs at requested size (withoutEnlargement disabled)

---

## Rate Limits

Currently no rate limits. Please use responsibly.

---

## File Retention

- **All uploaded and converted files are automatically deleted after 15 minutes**
- Files are stored in a temporary directory
- An automated cleanup process runs every 5 minutes
- No user data is stored permanently

---

## Error Handling

All errors follow this structure:

```json
{
  "error": "Error type",
  "message": "Detailed error message (optional)"
}
```

**Common Error Codes**:
- `400` - Bad Request (invalid parameters, unsupported format)
- `404` - Not Found (file not found)
- `410` - Gone (file expired)
- `500` - Internal Server Error

---

## Examples

### Example 1: Convert Single Image to WebP
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "files=@photo.jpg" \
  -F "format=webp" \
  -F "quality=85"
```

### Example 2: Batch Convert with Resize
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "files=@img1.png" \
  -F "files=@img2.jpg" \
  -F "files=@img3.gif" \
  -F "format=avif" \
  -F "quality=80" \
  -F "width=1920" \
  -F "height=1080" \
  -F "fit=cover"
```

### Example 3: SVG to PNG
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "files=@icon.svg" \
  -F "format=png" \
  -F "width=512" \
  -F "height=512"
```

### Example 4: Download Converted File
```bash
# First, convert the image
RESPONSE=$(curl -X POST http://localhost:3000/api/convert \
  -F "files=@photo.jpg" \
  -F "format=webp")

# Extract download URL (requires jq)
DOWNLOAD_URL=$(echo $RESPONSE | jq -r '.results[0].downloadUrl')

# Download the file
curl -O "http://localhost:3000${DOWNLOAD_URL}"
```

---

## TypeScript Types

```typescript
// Supported formats
type ImageFormat = "jpeg" | "png" | "webp" | "avif" | "tiff" | "gif" | "heif" | "jxl";
type ResizeFit = "cover" | "contain" | "fill" | "inside" | "outside";

// Conversion options
interface ConversionOptions {
  format: ImageFormat;
  quality: number;
  width?: number;
  height?: number;
  fit: ResizeFit;
}

// Single result
interface ConversionResult {
  success: boolean;
  originalFilename: string;
  outputFilename?: string;
  downloadUrl?: string;
  originalSize?: number;
  convertedSize?: number;
  reductionPercent?: number;
  error?: string;
}

// API response
interface ConvertResponse {
  success: boolean;
  results: ConversionResult[];
  stats: {
    total: number;
    success: number;
    failed: number;
    totalOriginalSize: number;
    totalConvertedSize: number;
  };
}
```

---

## Support

For issues or questions:
- GitHub Issues: [Your Repository]
- CLI Tool: Run `bun run imgco --help` for CLI usage

---

## License

[Your License]

---

**Last Updated**: 2024
