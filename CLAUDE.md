---
description: Image Converter CLI Tool - Development Guidelines
globs: "*.ts, *.js, package.json, config.ts, index.ts"
alwaysApply: true
---

# Image Converter - Development Guidelines

> Project-specific instructions for AI agents and developers working on this image converter CLI tool.

## Project Context

This is a **CLI-only** image conversion tool built with Bun and Sharp. It converts images (SVG, JPEG, PNG) to optimized formats (WebP, AVIF, JPEG, PNG, TIFF) with advanced compression settings.

**Main Command:** `bun run imgco [options]`

**Key Files:**
- `index.ts` - Main CLI application and image processing logic
- `config.ts` - Configuration, presets, and compression settings
- `package.json` - Dependencies (Sharp) and scripts

**For detailed architecture, see `AGENTS.md`**

## Bun-Specific Guidelines

### Always Use Bun (NOT Node.js)

- ✅ `bun index.ts` or `bun run imgco`
- ❌ `node index.ts` or `ts-node index.ts`
- ✅ `bun install`
- ❌ `npm install` or `yarn install` or `pnpm install`
- ✅ `bun test`
- ❌ `jest` or `vitest`
- ✅ `Bun.file()` for file operations
- ❌ `fs.readFile()` or `fs.writeFile()` when possible
- ✅ `Bun.$` for shell commands
- ❌ `execa` or `child_process`

### Bun APIs Used in This Project

```typescript
// File operations (preferred over node:fs)
const fileSize = await Bun.file(path).size;
const content = await Bun.file(path).text();
await Bun.write(path, content);

// Shell commands
await Bun.$`rm -f ${filePath}`;

// Environment variables (auto-loaded, no dotenv needed)
const apiKey = process.env.API_KEY;
```

## Project-Specific Rules

### 1. Command Structure

**User-Facing Command:** Always use `bun run imgco` in documentation and help text.

```bash
# Correct examples
bun run imgco --width 800 --format webp
bun run imgco --clean

# Don't use these in docs
bun index.ts
node index.ts
```

### 2. Configuration Management

All default settings live in `config.ts`:
- Image dimensions (width, height)
- Quality and compression settings
- Format-specific optimizations
- Preset configurations

**Rule:** When adding new options:
1. Add to `ConversionConfig` interface in `config.ts`
2. Update `defaultConfig` object
3. Add CLI argument parser in `index.ts`
4. Update help text and README.md

### 3. File Operations

Use Bun APIs for file operations:

```typescript
// ✅ Good - Using Bun.file()
const inputSize = (await Bun.file(inputPath).size) / 1024;

// ❌ Avoid - Using Node.js fs
import { statSync } from 'node:fs';
const inputSize = statSync(inputPath).size / 1024;
```

**Exception:** Use `node:fs/promises` for `readdir()` and `mkdir()` as they're cleaner for directory operations.

### 4. Image Processing with Sharp

Always use the compression settings from `config.ts`:

```typescript
// ✅ Correct - Using config
const compressionSettings = getCompressionSettings(config.format || "webp");
transformer = transformer.webp({
  quality: config.quality || compressionSettings.quality,
  lossless: compressionSettings.lossless,
  effort: compressionSettings.effort,
});

// ❌ Incorrect - Hardcoded values
transformer = transformer.webp({ quality: 80 });
```

### 5. Error Handling

Always provide context in error messages:

```typescript
// ✅ Good - Context included
console.error(`Failed to transform ${inputPath}:`, error);

// ❌ Bad - No context
console.error(error);
```

Return boolean success indicators:

```typescript
async function transformImage(...) {
  try {
    // ... processing
    return true;
  } catch (error) {
    console.error(`Failed to transform ${inputPath}:`, error);
    return false;
  }
}
```

### 6. Filename Handling

Always slugify output filenames for URL safety:

```typescript
const fileBaseName = basename(file, extname(file));
const slugifiedName = slugify(fileBaseName);  // ✅ Always slugify
const outputFileName = `${slugifiedName}.${config.format}`;
```

### 7. Testing Workflow

Before committing changes:

```bash
# 1. Test help command
bun run imgco --help

# 2. Test cleanup
bun run imgco --clean

# 3. Test with sample images (if available)
bun run imgco

# 4. Test custom options
bun run imgco -w 800 -q 90 -f jpeg
```

## Dependencies

### Core Dependencies
- **Sharp (^0.34.5)** - Image processing library
  - Uses libvips (C++) for performance
  - Handles all format conversions
  - NEVER replace with ImageMagick or Jimp

### Development Dependencies
- **@types/bun** - TypeScript definitions for Bun
- **typescript (^5)** - Type checking

### Adding New Dependencies

```bash
# Add runtime dependency
bun add <package>

# Add dev dependency
bun add -d <package>

# Update all dependencies
bun update
```

## Code Style Guidelines

### TypeScript Configuration

- Strict mode enabled in `tsconfig.json`
- Use explicit types for function parameters
- Export types from `config.ts` for reuse

### Naming Conventions

- Functions: `camelCase` (e.g., `transformImage`, `slugify`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `SUPPORTED_FORMATS`, `DEFAULT_CONFIG`)
- Interfaces: `PascalCase` (e.g., `TransformConfig`, `ConversionConfig`)
- Files: `lowercase` (e.g., `index.ts`, `config.ts`)

### Function Organization

Order functions logically in `index.ts`:
1. Utility functions (`slugify`, `cleanDirectory`)
2. Core functions (`ensureDirectory`, `getImageFiles`)
3. Main processing (`transformImage`)
4. Entry point (`main`)

## Common Modification Patterns

### Adding a New CLI Option

1. **Parse argument in `main()`:**
   ```typescript
   case "--new-option":
     config.newOption = args[++i];
     break;
   ```

2. **Update help text:**
   ```typescript
   --new-option <value>  Description of option (default: X)
   ```

3. **Update README.md** with examples

### Adding a New Format

1. **Add to `SUPPORTED_FORMATS`:**
   ```typescript
   const SUPPORTED_FORMATS = [..., ".heif"];
   ```

2. **Add to type in `config.ts`:**
   ```typescript
   format: "jpeg" | "png" | "webp" | "avif" | "tiff" | "heif";
   ```

3. **Add compression settings:**
   ```typescript
   heif: { quality: 80, lossless: false, effort: 4 }
   ```

4. **Add case in `transformImage()`:**
   ```typescript
   case "heif":
     transformer = transformer.heif({...});
     break;
   ```

### Creating a New Preset

In `config.ts`:

```typescript
export const presets = {
  // Existing presets...

  // New preset
  myPreset: {
    ...defaultConfig,
    width: 1200,
    quality: 85,
    format: "jpeg" as const,
    compression: {
      ...defaultConfig.compression,
      jpeg: { quality: 85, progressive: true, mozjpeg: true },
    },
  },
};
```

## Documentation Requirements

When adding features, update:

1. **README.md** - User-facing documentation
2. **index.ts help text** - CLI `--help` output
3. **AGENTS.md** - Architecture and technical details
4. **This file (CLAUDE.md)** - Development guidelines (if needed)

## Performance Considerations

- Current implementation: Sequential processing (one image at a time)
- Sharp is already highly optimized (C++ bindings)
- For large batches, consider parallel processing with `Promise.all()`

**Do NOT implement parallel processing without user request** - sequential is simpler and sufficient for most use cases.

## What NOT to Do

❌ Don't use Node.js instead of Bun
❌ Don't use `npm` or `yarn` commands
❌ Don't add frontend/server code (this is CLI-only)
❌ Don't use `fs` when `Bun.file()` works
❌ Don't hardcode configuration values (use `config.ts`)
❌ Don't skip slugifying filenames
❌ Don't add dependencies without justification
❌ Don't create markdown docs unless explicitly requested
❌ Don't use emojis unless user requests them

## What TO Do

✅ Always use `bun run imgco` in examples
✅ Use Bun APIs (`Bun.file()`, `Bun.$`)
✅ Pull defaults from `config.ts`
✅ Slugify all output filenames
✅ Provide context in error messages
✅ Test changes before committing
✅ Update documentation when adding features
✅ Use TypeScript types properly
✅ Follow existing code patterns

## Quick Reference

**Run the tool:**
```bash
bun run imgco [options]
```

**Test changes:**
```bash
bun run imgco --help
bun run imgco --clean
bun run imgco # with test images
```

**Install dependencies:**
```bash
bun install
```

**Update dependencies:**
```bash
bun update
```

**Read architecture docs:**
```bash
cat AGENTS.md
```

---

**For detailed architecture and modification guides, see `AGENTS.md`**
