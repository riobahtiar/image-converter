# Image Converter

High-performance image conversion tool with **CLI** and **Web App** interfaces. Convert images to WebP, AVIF, JPEG, PNG, and more with advanced compression.

Built with [Bun](https://bun.sh) and [Sharp](https://sharp.pixelplumbing.com/).

---

## 🚀 Quick Start

### Web App (Browser)
```bash
bun dev
# Open http://localhost:3000
```
- Drag & drop images
- Bulk conversion
- Download results
- Auto-cleanup after 15 minutes

### CLI (Terminal)
```bash
# Place images in raw/ folder
bun run imgco

# Custom options
bun run imgco -w 800 -f webp -q 85
```

---

## ✨ Features

- **Multiple formats**: JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIF, SVG
- **Bulk processing**: Convert multiple images at once
- **Smart compression**: Format-specific optimization
- **Custom dimensions**: Resize with aspect ratio control
- **Two interfaces**: Web UI or command line
- **Fast**: Powered by Sharp (libvips C++ library)
- **Auto-cleanup**: Web app deletes files after 15 minutes

---

## 📦 Installation

```bash
bun install
```

---

## 🖥️ CLI Usage

### Basic Commands

```bash
# Convert with defaults (WebP, 80% quality)
bun run imgco

# Custom format and quality
bun run imgco -f avif -q 85

# Resize images
bun run imgco -w 1920 -h 1080

# Clean up directories
bun run imgco --clean

# Clear logs
bun run imgco --clear-logs

# Show help
bun run imgco --help
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --width` | Width in pixels | auto |
| `-h, --height` | Height in pixels | auto |
| `-f, --format` | Output format (jpeg, png, webp, avif, etc.) | webp |
| `-q, --quality` | Quality 1-100 | 80 |
| `--fit` | Resize mode (cover, contain, fill, inside, outside) | inside |
| `-s, --source` | Source directory | ./raw |
| `-o, --output` | Output directory | ./results |
| `--clean` | Clean directories | - |
| `--clear-logs` | Clear log files | - |

### Examples

```bash
# Convert SVG to PNG at 512x512
bun run imgco -w 512 -h 512 -f png

# High quality WebP
bun run imgco -f webp -q 95

# Thumbnails with crop
bun run imgco -w 300 -h 300 --fit cover

# Different directories
bun run imgco -s ./photos -o ./optimized
```

---

## 🌐 Web App Usage

### Start Server

```bash
# Development
bun dev

# Production
bun run build
bun start
```

### Features

- **Drag & Drop**: Upload multiple files
- **Live Preview**: See file sizes and compression stats
- **Bulk Download**: Download all converted images
- **Settings**: Format, quality, dimensions, resize mode
- **Progress**: Real-time conversion progress
- **Auto-Cleanup**: Files deleted after 15 minutes

### API Endpoints

**Convert Images**
```bash
POST /api/convert
Content-Type: multipart/form-data

# Parameters: files, format, quality, width, height, fit
```

**Download Image**
```bash
GET /api/download/[filename]
```

See [API.md](./API.md) for complete documentation.

---

## 📁 Supported Formats

### Input
JPEG, PNG, WebP, GIF, **SVG**, AVIF, HEIF, TIFF, BMP, JPEG XL

### Output
JPEG, PNG, WebP, AVIF, GIF, TIFF, HEIF, JPEG XL

### Format Guide

| Format | Best For | Compression | Browser Support |
|--------|----------|-------------|-----------------|
| **WebP** | Web images | Excellent | 95%+ |
| **AVIF** | Modern web | Best | 75%+ |
| **JPEG** | Photos | Good | 100% |
| **PNG** | Graphics with transparency | Lossless | 100% |
| **SVG** → Raster | Icons, logos | - | Source only |

---

## ⚙️ Configuration

Edit `config.ts` to change defaults:

```typescript
export const defaultConfig = {
  format: "webp",
  quality: 80,
  fit: "inside",
  sourceDir: "./raw",
  outputDir: "./results",
  // ... advanced compression settings
};
```

### Presets Available

- `highQuality` - Maximum quality (Q95)
- `web` - Optimized for web (Q80)
- `thumbnail` - Small previews (300x300)
- `maxCompression` - Smallest files (Q60)
- `lossless` - No quality loss

---

## 🔧 Advanced Features

### Subdirectory Support
```bash
# CLI automatically preserves folder structure
raw/
  folder1/image.jpg
  folder2/subfolder/photo.png

# Converts to:
results/
  folder1/image.webp
  folder2/subfolder/photo.webp
```

### SVG Conversion
SVG files can be rasterized to any size (no upscale limits):
```bash
bun run imgco -w 2048 -f png  # SVG → 2048px PNG
```

### Logging (CLI)
Errors are logged to `logs/error.log` with timestamps:
```bash
bun run imgco --clear-logs  # Clear old logs
```

### Circuit Breaker (CLI)
Automatic failure protection - stops processing if too many errors occur.

---

## 🛠️ Development

```bash
# Run web app
bun dev

# Run CLI
bun run imgco

# Lint code
bun run lint

# Format code
bun run format
```

### Project Structure

```
image-converter/
├── index.ts              # CLI application
├── config.ts             # Shared configuration
├── app/                  # Next.js web app
│   ├── api/             # API routes
│   └── page.tsx         # Main UI
├── lib/                  # Shared conversion logic
│   └── converter/       # Core image processing
├── components/ui/        # UI components
└── public/uploads/       # Temporary files (web)
```

---

## 📖 Documentation

- **[AGENTS.md](./AGENTS.md)** - Architecture and technical details
- **[API.md](./API.md)** - API reference for web app
- **[CLAUDE.md](./CLAUDE.md)** - Quick development reference

---

## 🚀 Deployment

### Vercel (Web App)
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

---

## 🤝 Contributing

1. Follow existing code style
2. Use Biome for linting: `bun run lint`
3. Format code: `bun run format`
4. Test both CLI and web app

---

## 📝 License

MIT

---

## 🙏 Credits

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Sharp](https://sharp.pixelplumbing.com/) - High-performance image processing
- [Next.js](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful components

---

**Made with ❤️ using Bun and Sharp**
