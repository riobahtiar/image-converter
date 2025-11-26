# AGENTS.md - Image Converter Project

> Documentation for AI agents working with this codebase

## Project Overview

**Image Converter** is a high-performance CLI tool built with Bun and Sharp that transforms images in bulk. It converts SVG, JPEG, JPG, and PNG images to optimized WebP format (or other formats).

### Core Purpose
- Batch process multiple images
- Convert to web-optimized formats
- Resize and compress images
- Generate URL-safe filenames
- Provide easy cleanup utilities

## Project Structure

```
image-converter/
├── index.ts              # Main CLI application
├── config.ts             # Configuration and presets
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── raw/                  # Source images directory
├── results/              # Output images directory
├── README.md             # User documentation
├── CLAUDE.md             # Project instructions (use Bun)
└── AGENTS.md             # This file
```

## Architecture

### 1. Main Entry Point (`index.ts`)

**Key Functions:**
- `slugify(text: string)` - Converts filenames to URL-safe format
- `cleanDirectory(dir: string)` - Removes files from directories
- `ensureDirectory(dir: string)` - Creates directories if needed
- `getImageFiles(sourceDir: string)` - Filters supported image files
- `transformImage(inputPath, outputPath, config)` - Core image processing
- `main()` - CLI argument parsing and orchestration

**Flow:**
1. Parse CLI arguments
2. Handle special commands (`--help`, `--clean`)
3. Ensure directories exist
4. Scan for images
5. Process each image with Sharp
6. Report statistics (file size, compression ratio)

### 2. Configuration (`config.ts`)

**Exports:**
- `ConversionConfig` interface - TypeScript types
- `defaultConfig` - Default settings
- `presets` - Pre-configured settings (highQuality, web, thumbnail, etc.)
- `getCompressionSettings()` - Format-specific compression

**Configuration Hierarchy:**
1. Default config from `config.ts`
2. Overridden by CLI arguments
3. Format-specific compression settings applied

### 3. Command System

**Command:** `bun run imgco [options]`

**Options:**
- `-w, --width` - Width in pixels
- `-h, --height` - Height in pixels
- `-f, --format` - Output format (jpeg, png, webp, avif, tiff)
- `-q, --quality` - Quality 1-100
- `--fit` - Resize mode (cover, contain, fill, inside, outside)
- `-s, --source` - Source directory
- `-o, --output` - Output directory
- `--clean` - Clean up directories
- `--help` - Show help

## Technology Stack

### Core Dependencies
- **Bun** - JavaScript runtime (NOT Node.js)
- **Sharp** - High-performance image processing (libvips)
- **TypeScript** - Type safety

### Why Sharp?
- C++ bindings to libvips
- 4-5x faster than ImageMagick
- Handles SVG, JPEG, PNG, WebP natively
- Used by Netflix, BBC, Shopify

## Key Features Explained

### 1. URL-Safe Filename Slugification

**Location:** `index.ts:35-45`

Converts filenames to web-safe format:
- Lowercase conversion
- Spaces → hyphens
- Special chars → hyphens
- Removes consecutive hyphens

**Example:**
```typescript
slugify("My Photo 2024!.jpg") // → "my-photo-2024"
```

### 2. Advanced Compression Settings

**Location:** `config.ts:50-108`

Each format has optimized settings:
- **WebP**: effort level 4, quality 80
- **AVIF**: effort level 4, quality 75
- **JPEG**: MozJPEG + progressive loading
- **PNG**: compression level 9
- **TIFF**: LZW compression

### 3. Directory Cleanup

**Location:** `index.ts:50-70`

Removes all files except `.gitkeep`:
```bash
bun run imgco --clean
```

### 4. File Size Reporting

**Location:** `index.ts:263-270`

Shows:
- Original size
- Compressed size
- Percentage reduction

## Common Modification Tasks

### Adding a New Image Format

1. Update `SUPPORTED_FORMATS` in `index.ts:26`
2. Add format to `ConversionConfig` type in `config.ts:11`
3. Add compression settings in `config.ts:50-108`
4. Add case in `transformImage()` switch statement `index.ts:72-107`

**Example:**
```typescript
// config.ts
format: "jpeg" | "png" | "webp" | "avif" | "tiff" | "heif";

// config.ts - compression settings
heif: {
  quality: 80,
  lossless: false,
  effort: 4,
}

// index.ts - transformImage()
case "heif":
  transformer = transformer.heif({
    quality: config.quality || compressionSettings.quality,
    lossless: compressionSettings.lossless,
    effort: compressionSettings.effort,
  });
  break;
```

### Adding a New CLI Option

1. Add to argument parser in `main()` function `index.ts:125-237`
2. Update help text `index.ts:211-236`
3. Update README.md examples
4. If needed, add to `TransformConfig` interface `index.ts:7-14`

### Modifying Default Settings

Edit `config.ts:42-61`:
```typescript
export const defaultConfig: ConversionConfig = {
  width: 1920,        // Change default width
  height: 1080,       // Change default height
  format: "webp",     // Change default format
  quality: 80,        // Change default quality
  // ... etc
};
```

### Adding a New Preset

Edit `config.ts:110-169`:
```typescript
export const presets = {
  // Add new preset
  socialMedia: {
    ...defaultConfig,
    width: 1200,
    height: 630,  // Open Graph size
    quality: 85,
    format: "jpeg" as const,
  },
};
```

## Best Practices for Modifications

### 1. Always Use Bun (Not Node.js)
- Use `bun index.ts` NOT `node index.ts`
- Use `Bun.file()` NOT `fs.readFile()`
- See `CLAUDE.md` for Bun-specific guidelines

### 2. Maintain Type Safety
- Update TypeScript interfaces when adding features
- Use proper types for Sharp options
- Export types from `config.ts` when needed

### 3. Error Handling
- Always use try-catch in async functions
- Return boolean success indicators
- Log errors with context (filename, path)

### 4. Testing Checklist
Before committing changes:
```bash
# Test basic functionality
bun run imgco --help

# Test with sample images (if available)
bun run imgco

# Test cleanup
bun run imgco --clean

# Test custom options
bun run imgco -w 800 -q 90 -f jpeg
```

### 5. Documentation Updates
When adding features, update:
- `README.md` - User-facing documentation
- `index.ts` help text - CLI help
- `AGENTS.md` - This file for architecture changes

## Sharp API Reference

### Common Sharp Operations

```typescript
// Basic resize
sharp(input).resize(800, 600).toFile(output);

// Preserve aspect ratio
sharp(input)
  .resize({ width: 800, height: 600, fit: 'inside' })
  .toFile(output);

// Format conversion
sharp(input)
  .webp({ quality: 80, effort: 4 })
  .toFile(output);

// Chaining operations
sharp(input)
  .resize(1920, 1080, { fit: 'cover' })
  .webp({ quality: 85 })
  .toFile(output);
```

### Fit Modes
- `inside` - Preserve aspect ratio, fit within dimensions
- `cover` - Preserve aspect ratio, cover dimensions (crop)
- `contain` - Preserve aspect ratio, add padding
- `fill` - Ignore aspect ratio, stretch
- `outside` - Preserve aspect ratio, ensure >= dimensions

## Debugging Tips

### 1. Check File Paths
```typescript
console.log(`Input: ${inputPath}`);
console.log(`Output: ${outputPath}`);
```

### 2. Inspect Sharp Metadata
```typescript
const metadata = await sharp(inputPath).metadata();
console.log(metadata);
```

### 3. Test Compression Settings
```typescript
const settings = getCompressionSettings("webp");
console.log(settings);
```

### 4. Validate CLI Args
```typescript
console.log("Parsed config:", config);
console.log("Source dir:", sourceDir);
console.log("Output dir:", outputDir);
```

## Performance Considerations

### Current Implementation
- Sequential processing (one image at a time)
- Suitable for small to medium batches
- Sharp itself is highly optimized (C++)

### Potential Optimizations
If processing speed becomes an issue:

1. **Parallel Processing:**
```typescript
await Promise.all(
  imageFiles.map(file => transformImage(file, ...))
);
```

2. **Streaming for Large Files:**
```typescript
sharp(inputPath)
  .resize(...)
  .toBuffer()
  .then(buffer => Bun.write(outputPath, buffer));
```

3. **Progress Indicators:**
```typescript
// Add progress bar library
import { ProgressBar } from 'some-library';
const progress = new ProgressBar(imageFiles.length);
```

## Common Issues and Solutions

### Issue: "Module not found: sharp"
**Solution:** Run `bun install`

### Issue: SVG not converting
**Solution:** Sharp requires librsvg. Check Sharp documentation for installation.

### Issue: Images not found
**Solution:**
- Check `sourceDir` path is correct
- Verify file extensions are supported
- Ensure files aren't hidden

### Issue: Permission denied
**Solution:**
```bash
chmod 755 raw
chmod 755 results
```

### Issue: Out of memory (large batch)
**Solution:**
- Process in smaller batches
- Reduce quality/dimensions
- Implement streaming

## Extension Ideas

### Features to Consider Adding

1. **Watch Mode**
   - Monitor directory for new files
   - Auto-convert on file add

2. **Batch Size Limiting**
   - Process N images at a time
   - Prevent memory issues

3. **Metadata Preservation**
   - Keep EXIF data
   - Preserve color profiles

4. **Image Optimization Detection**
   - Skip already optimized images
   - Compare file sizes before processing

5. **Multiple Output Formats**
   - Generate multiple formats from one source
   - Create responsive image sets

6. **Config File Support**
   - Load settings from `.imgcorc` file
   - JSON/YAML configuration

7. **Dry Run Mode**
   - Preview changes without processing
   - Show estimated file sizes

8. **Watermarking**
   - Add text/image watermarks
   - Configurable position

## Git Workflow

### Files Tracked
- `index.ts` - Main application
- `config.ts` - Configuration
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `README.md` - Documentation
- `CLAUDE.md` - Project instructions
- `AGENTS.md` - This file
- `.gitignore` - Git ignore rules

### Files Ignored
- `node_modules/` - Dependencies
- `raw/*` - Source images (user data)
- `results/*` - Output images (generated)
- `.DS_Store` - macOS metadata

### Commit Guidelines
- Use conventional commits
- Keep commits focused
- Update docs with features

## Environment Requirements

### Required
- Bun v1.3.3 or higher
- TypeScript 5+

### Optional
- Git (for version control)
- librsvg (for SVG support in Sharp)

## Testing Strategy

### Manual Testing
1. Place test images in `raw/`
2. Run `bun run imgco`
3. Verify output in `results/`
4. Check file sizes and quality

### Test Cases to Cover
- [ ] JPEG to WebP conversion
- [ ] PNG to WebP conversion
- [ ] SVG to WebP conversion
- [ ] Resize with aspect ratio
- [ ] Custom quality settings
- [ ] Custom dimensions
- [ ] Multiple format outputs
- [ ] Directory cleanup
- [ ] Custom source/output paths
- [ ] Filename slugification
- [ ] Empty directory handling
- [ ] Invalid file handling

## Support and Resources

### Documentation
- [Bun Documentation](https://bun.sh/docs)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Related Projects
- ImageMagick - Alternative image processor
- VIPS - Library Sharp uses
- Squoosh - Web-based image compressor

## Project Maintenance

### Dependency Updates
```bash
bun update
```

### Check for Outdated Packages
```bash
bun outdated
```

### Version Bumping
Update `package.json` version following semantic versioning:
- MAJOR.MINOR.PATCH
- Breaking.Feature.Fix

---

**Last Updated:** 2025-11-25
**Bun Version:** 1.3.3
**Sharp Version:** 0.34.5
**Agent Type:** Claude Code (Sonnet 4.5)
