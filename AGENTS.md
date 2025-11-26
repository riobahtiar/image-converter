# Image Converter - Technical Documentation

> Architecture and development guide for AI agents and developers

---

## Overview

**Image Converter** is a dual-interface image conversion tool:
- **CLI**: Command-line tool for batch processing (`bun run imgco`)
- **Web App**: Next.js interface with drag-and-drop (`bun dev`)

**Core**: Both share the same conversion logic powered by Bun and Sharp.

---

## Project Structure

```
image-converter/
├── CLI
│   ├── index.ts                    # Main CLI application
│   ├── config.ts                   # Configuration (shared)
│   ├── raw/                        # Input images
│   └── results/                    # Output images
│
├── Web App (Next.js 16)
│   ├── app/
│   │   ├── api/
│   │   │   ├── convert/route.ts   # POST /api/convert
│   │   │   └── download/[filename]/route.ts  # GET /api/download
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Main UI
│   │   └── globals.css            # Tailwind styles
│   ├── components/ui/              # shadcn/ui components
│   └── public/uploads/temp/        # Temporary storage (15min)
│
├── Shared Logic
│   └── lib/
│       ├── converter/
│       │   ├── core.ts            # convertImage() function
│       │   ├── types.ts           # TypeScript types
│       │   └── index.ts           # Exports
│       ├── cache.ts               # File auto-cleanup
│       └── utils.ts               # Utilities
│
├── Config
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── biome.json
│   └── tsconfig.json
│
└── Docs
    ├── README.md                   # User guide
    ├── AGENTS.md                   # This file
    ├── API.md                      # API reference
    └── CLAUDE.md                   # Quick ref → AGENTS.md
```

---

## CLI Architecture

### Entry Point: `index.ts`

**Key Functions:**

```typescript
// Filename sanitization
function slugify(text: string): string

// Directory operations
async function cleanDirectory(dir: string): Promise<number>
async function ensureDirectory(dir: string): Promise<void>

// Image discovery
async function getImageFiles(sourceDir: string): Promise<string[]>

// Core processing
async function transformImage(
  inputPath: string,
  outputPath: string,
  config: TransformConfig,
  logger?: Logger
): Promise<boolean>

// Batch processing with circuit breaker
async function processBatch(
  files: string[],
  sourceDir: string,
  outputDir: string,
  config: TransformConfig,
  circuitBreaker: CircuitBreaker,
  logger: Logger
): Promise<Stats>

// CLI entry
async function main(): Promise<void>
```

**Flow:**
1. Parse CLI arguments (width, height, format, quality, etc.)
2. Handle special commands (--help, --clean, --clear-logs)
3. Ensure directories exist
4. Scan for supported images (including subdirectories)
5. Process images with Sharp
6. Log results and errors
7. Report statistics

**Special Features:**
- **Circuit Breaker**: Stops processing after 5 consecutive failures
- **Logger**: JSON logs to `logs/error.log` and `logs/info.log`
- **Subdirectory Support**: Preserves folder structure
- **SVG Handling**: Disables `withoutEnlargement` for vector graphics

---

## Web App Architecture

### API Routes

#### `POST /api/convert`

**Purpose**: Upload and convert images

**Input**: `multipart/form-data`
- `files`: File[] (required)
- `format`: ImageFormat (default: "webp")
- `quality`: number (default: 80)
- `width`, `height`: number (optional)
- `fit`: ResizeFit (default: "inside")

**Process**:
1. Validate files and parameters
2. Save uploads to `public/uploads/temp/`
3. Convert using `convertImage()` from `lib/converter/core.ts`
4. Return results with download URLs

**Output**:
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
    }
  ],
  "stats": {
    "total": 1,
    "success": 1,
    "failed": 0,
    "totalOriginalSize": 524288,
    "totalConvertedSize": 98304
  }
}
```

#### `GET /api/download/[filename]`

**Purpose**: Download converted image

**Security**:
- Path traversal prevention (validates filename)
- File expiration check (15 minutes max age)
- Content-Type based on extension

**Response**: Binary image with proper headers

### Main UI: `app/page.tsx`

**Client Component** with React state:

```typescript
const [files, setFiles] = useState<File[]>([]);           // Selected files
const [converting, setConverting] = useState(false);      // Processing state
const [results, setResults] = useState<ConversionResult[]>([]);  // Results
const [format, setFormat] = useState<ImageFormat>("webp");
const [quality, setQuality] = useState(80);
// ... other settings
```

**Features**:
- Drag & drop file upload
- Format/quality/dimension settings
- Progress indicators
- Results display with stats
- Individual and bulk download

### File Caching: `lib/cache.ts`

```typescript
class FileCache {
  constructor(cacheDir = "./public/uploads/temp", maxAgeMinutes = 15)
  async cleanup(): Promise<number>  // Delete expired files
  getFilePath(filename: string): string
  async fileExists(filename: string): Promise<boolean>
  async getFileAge(filename: string): Promise<number>
}

// Singleton instance
export const fileCache = new FileCache();
```

**Auto-Cleanup**:
- Runs every 5 minutes
- Deletes files older than 15 minutes
- Automatic on server start

---

## Shared Conversion Logic

### Core Function: `lib/converter/core.ts`

```typescript
export async function convertImage(
  inputPath: string | Buffer,    // File path or uploaded buffer
  outputPath: string,
  options: ConversionOptions
): Promise<ConversionResult>
```

**Features**:
- Accepts file path (CLI) or Buffer (Web)
- Applies transformations from `config.ts`
- Format-specific compression settings
- SVG special handling (no enlargement restriction)
- Metadata handling
- Background color for transparency

**Used By**:
- CLI: `index.ts` → `transformImage()` → `convertImage()`
- Web: `/api/convert` → `convertImage()`

### Configuration: `config.ts`

**Shared between CLI and Web**:

```typescript
export const defaultConfig = {
  width: 1920,
  height: 1080,
  format: "webp",
  quality: 80,
  fit: "inside",
  withoutEnlargement: true,
  preserveAspectRatio: true,
  sourceDir: "./raw",
  outputDir: "./results",
  transformations: { /* rotate, flip, grayscale, etc. */ },
  metadata: { /* EXIF, ICC handling */ },
  compression: { /* format-specific settings */ },
  performance: { parallel: false, maxParallel: 4 }
};

export function getCompressionSettings(format: ImageFormat);
```

**13 Presets Available**:
- `highQuality`, `web`, `thumbnail`, `socialMedia`, `favicon`, `retina`, `email`, `print`, `mobile`, `maxCompression`, `lossless`, `grayscale`, `speed`

---

## Technology Stack

### Runtime & Build
- **Bun**: JavaScript runtime (1.3.3+)
- **TypeScript**: Type safety (strict mode)
- **Biome.js**: Linting and formatting

### CLI
- **Sharp**: Image processing (0.34.5)
- **Bun APIs**: File operations (`Bun.file()`, `Bun.$`)

### Web App
- **Next.js**: 16.0.4 (App Router)
- **React**: 19.2.0
- **Tailwind CSS**: 4.1.17 (with @tailwindcss/postcss)
- **shadcn/ui**: UI components
- **lucide-react**: Icons

### Image Processing
- **Sharp**: libvips bindings (C++)
- **Supported Input**: JPEG, PNG, WebP, GIF, SVG, AVIF, HEIF, TIFF, BMP, JPEG XL
- **Supported Output**: JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIF, JPEG XL

---

## Development Workflow

### Running the Apps

```bash
# Web App
bun dev                 # Development (http://localhost:3000)
bun run build          # Production build
bun start              # Production server

# CLI
bun run imgco          # Convert images
bun run imgco --help   # Show help

# Code Quality
bun run lint           # Check with Biome
bun run format         # Format with Biome
```

### Making Changes

**To CLI Only**:
1. Edit `index.ts`
2. Update CLI argument parsing
3. Update help text
4. Test: `bun run imgco`

**To Web Only**:
1. Edit `app/page.tsx` (UI)
2. Edit `app/api/*/route.ts` (API)
3. Test: `bun dev`

**To Both (Shared Logic)**:
1. Edit `config.ts` (settings)
2. Edit `lib/converter/core.ts` (conversion logic)
3. Edit `lib/converter/types.ts` (types)
4. Test both CLI and Web

### Adding New Format

1. **Add type** in `lib/converter/types.ts`:
   ```typescript
   export type ImageFormat = "jpeg" | "png" | ... | "newformat";
   ```

2. **Add compression settings** in `config.ts`:
   ```typescript
   newformat: { quality: 80, /* format-specific options */ }
   ```

3. **Add conversion case** in `lib/converter/core.ts`:
   ```typescript
   case "newformat":
     transformer = transformer.newformat({...});
     break;
   ```

4. **Update UI** in `app/page.tsx`:
   ```typescript
   <option value="newformat">New Format</option>
   ```

---

## Testing

### CLI Testing

```bash
# Basic test
bun run imgco

# With options
bun run imgco -w 800 -f webp -q 85

# Test cleanup
bun run imgco --clean

# Test logs
bun run imgco --clear-logs
```

### Web App Testing

```bash
# Start server
bun dev

# Manual testing at http://localhost:3000
- Upload single/multiple files
- Change settings
- Convert images
- Download results
- Wait 15+ minutes to test auto-cleanup
```

### API Testing

```bash
# Convert
curl -X POST http://localhost:3000/api/convert \
  -F "files=@test.jpg" \
  -F "format=webp" \
  -F "quality=85"

# Download
curl -O http://localhost:3000/api/download/[filename]
```

---

## Common Tasks

### Update Dependencies

```bash
bun update
```

### Fix Linting Issues

```bash
bun run lint          # Check
bun run format        # Auto-fix
```

### Debug Issues

**CLI**:
- Check `logs/error.log` for errors
- Use `console.log()` in `index.ts`
- Run with `bun --inspect index.ts`

**Web**:
- Check browser console
- Check terminal output
- Inspect Network tab for API calls

### Clean Everything

```bash
bun run imgco --clean        # Clean raw/results
bun run imgco --clear-logs   # Clear logs
rm -rf public/uploads/temp/* # Clear web uploads
rm -rf .next                 # Clear Next.js cache
```

---

## Key Concepts

### Circuit Breaker Pattern

**Purpose**: Prevent cascading failures in batch processing

**States**:
- `CLOSED`: Normal operation
- `OPEN`: Too many failures, stop processing
- `HALF_OPEN`: Testing if system recovered

**Thresholds**:
- Opens after 5 consecutive failures
- Attempts recovery after 30 seconds

**Implementation**: `class CircuitBreaker` in `index.ts`

### File Caching (Web)

**Purpose**: Auto-delete uploaded files for privacy

**Mechanism**:
- Files stored in `public/uploads/temp/`
- Cleanup runs every 5 minutes
- Deletes files older than 15 minutes
- Singleton pattern: `fileCache`

### SVG Handling

**Issue**: Default `withoutEnlargement: true` prevents SVG upscaling

**Solution**: Detect SVG and disable `withoutEnlargement`

```typescript
const isSvg = extname(inputPath).toLowerCase() === ".svg";
const allowEnlargement = isSvg ? false : defaultConfig.withoutEnlargement;
```

---

## File Organization

### What's Tracked (Git)

- **Source**: `index.ts`, `config.ts`, `app/**`, `lib/**`, `components/**`
- **Config**: `package.json`, `tsconfig.json`, `*.config.ts`, `biome.json`
- **Docs**: `README.md`, `AGENTS.md`, `API.md`, `CLAUDE.md`

### What's Ignored

- `node_modules/`, `.next/`, `dist/`, `build/`
- `raw/*`, `results/*` (except `.gitkeep`)
- `logs/*` (except `.gitkeep`)
- `public/uploads/*` (except `.gitkeep`)

---

## Performance Notes

- **Sharp**: 4-5x faster than ImageMagick
- **Parallel Processing**: CLI supports up to `maxParallel` concurrent conversions
- **SVG**: No size penalties, rasterizes at any dimension
- **WebP**: Best balance of speed and quality
- **AVIF**: Best compression, slower processing

---

## Deployment

### Web App on Vercel

```bash
vercel
```

### Docker

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install && bun run build
CMD ["bun", "start"]
```

### Environment Variables

None required for basic operation. Optional:
- `NODE_ENV`: production/development
- `PORT`: Server port (default: 3000)

---

## Troubleshooting

### "Module not found"

```bash
rm -rf node_modules
bun install
```

### Sharp Installation Fails

```bash
bun install sharp --force
```

### Web App CSS Issues

Make sure you have `@tailwindcss/postcss`:

```bash
bun add -D @tailwindcss/postcss
```

### Files Not Auto-Deleting

Check `lib/cache.ts` - ensure cleanup interval is running.

---

## Documentation

- **[README.md](./README.md)** - User guide and quick start
- **[API.md](./API.md)** - Complete API reference
- **[CLAUDE.md](./CLAUDE.md)** - Quick development reference
- **[AGENTS.md](./AGENTS.md)** - This file

---

## Version Info

- **Last Updated**: 2024-11-26
- **Bun**: 1.3.3+
- **Sharp**: 0.34.5
- **Next.js**: 16.0.4
- **React**: 19.2.0
- **Node**: 18+ or Bun runtime

---

**Status**: Production ready ✅
