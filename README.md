# Image Converter

High-performance image transformation tool built with Bun and Sharp. Converts SVG, JPEG, JPG, and PNG images to optimized WebP format.

## Features

- Batch process multiple images at once
- Convert SVG/JPEG/JPG/PNG to WebP (default)
- Support for multiple output formats (JPEG, PNG, WebP, AVIF, TIFF)
- Automatic image resizing with aspect ratio preservation
- Quality control and optimization
- File size comparison and compression statistics
- **URL-safe filenames** - Automatically slugifies output filenames
- **Advanced compression settings** - Format-specific optimization via config file
- **Cleanup command** - Easily clear processed files
- Fast processing with Sharp (C++ bindings)

## Installation

```bash
bun install
```

## Quick Start

1. Place your images in the `raw` folder
2. Run the converter:

```bash
bun run imgco
```

3. Find your converted images in the `results` folder

By default, this converts all images to WebP format at 1920x1080 (max dimensions) with 80% quality.

## Usage

### Basic Usage

Convert all images with default settings (to WebP):
```bash
bun run imgco
```

### Custom Options

```bash
# Convert to JPEG with 90% quality
bun run imgco --format jpeg --quality 90

# Resize to specific dimensions
bun run imgco --width 800 --height 600

# Use custom source and output directories
bun run imgco --source ./photos --output ./optimized

# Convert to WebP with custom quality
bun run imgco -f webp -q 85 -w 1200
```

### Command Line Options

```
-w, --width <number>       Width in pixels (default: 1920)
-h, --height <number>      Height in pixels (default: 1080)
-f, --format <format>      Output format: jpeg, png, webp, avif, tiff (default: webp)
-q, --quality <number>     Quality 1-100 (default: 80)
--fit <mode>               Resize fit mode: cover, contain, fill, inside, outside (default: inside)
-s, --source <path>        Source directory (default: ./raw)
-o, --output <path>        Output directory (default: ./results)
--clean [source] [output]  Clean up files in directories
--help                     Show help message
```

### Cleanup Command

Remove all processed files from directories:

```bash
# Clean default directories (raw and results)
bun run imgco --clean

# Clean specific directories
bun run imgco --clean ./raw ./results
```

### Supported Input Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- SVG (.svg)
- GIF (.gif)
- TIFF (.tiff)
- AVIF (.avif)

### Fit Modes

- `inside` (default) - Preserve aspect ratio, fit within dimensions
- `cover` - Preserve aspect ratio, cover dimensions (may crop)
- `contain` - Preserve aspect ratio, ensure image contains dimensions
- `fill` - Ignore aspect ratio, stretch to exact dimensions
- `outside` - Preserve aspect ratio, ensure image is outside dimensions

## Configuration

### Default Settings

All default settings can be modified in `config.ts`:

```typescript
// config.ts
export const defaultConfig = {
  width: 1920,
  height: 1080,
  format: "webp",
  quality: 80,
  fit: "inside",
  sourceDir: "./raw",
  outputDir: "./results",
  // ... and more compression settings
};
```

Modify this file to change default behavior without using CLI arguments every time.

### URL-Safe Filenames

Output filenames are automatically slugified for URL safety:

- `My Photo 2024!.jpg` → `my-photo-2024.webp`
- `Product Image (1).png` → `product-image-1.webp`
- `Logo @Company.svg` → `logo-company.webp`

All special characters, spaces, and uppercase letters are converted to lowercase with hyphens.

### Advanced Compression

Each format has optimized compression settings in `config.ts`:

- **WebP**: effort level 4 (balance speed/quality)
- **AVIF**: effort level 4, quality 75 (best for modern browsers)
- **JPEG**: MozJPEG + progressive loading
- **PNG**: compression level 9, progressive

You can also use presets like `highQuality`, `web`, `thumbnail`, `maxCompression`, or `lossless`.

## Examples

Convert SVG/PNG/JPEG to WebP with high quality:
```bash
bun run imgco --quality 95
```

Create thumbnails:
```bash
bun run imgco --width 300 --height 300 --fit cover
```

Convert to AVIF (modern format with better compression):
```bash
bun run imgco --format avif --quality 75
```

Clean up all processed files:
```bash
bun run imgco --clean
```

## Technology

- **Bun**: Fast JavaScript runtime
- **Sharp**: High-performance image processing library (libvips)

This project was created using Bun v1.3.3. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
