---
description: Image Converter (CLI + Web) - Development Guidelines
globs: "*.ts, *.tsx, *.js, package.json, config.ts, index.ts, app/**, lib/**, components/**"
alwaysApply: true
---

# Image Converter - Development Guidelines

> Project-specific instructions for AI agents and developers working on this image converter tool.

## Quick Reference

**📖 For detailed architecture, guidelines, and development instructions, see:**

## → [`AGENTS.md`](./AGENTS.md)

The `AGENTS.md` file contains comprehensive documentation including:
- Project architecture (CLI + Web App)
- File structure and key files
- Development guidelines and best practices
- Bun-specific instructions
- Code modification patterns
- Testing procedures
- Technology stack details

---

## TL;DR

### Project Overview
- **CLI Tool**: `bun run imgco` - Command-line image converter
- **Web App**: `bun dev` - Next.js web interface for image conversion
- **Shared Logic**: Both apps use the same conversion library (`lib/converter/`)

### Key Commands
```bash
# CLI
bun run imgco                    # Convert images
bun run imgco --help             # Show help

# Web App
bun dev                          # Start development server
bun run build                    # Build for production
bun start                        # Start production server

# Code Quality
bun run lint                     # Check code with Biome
bun run format                   # Format code with Biome
```

### Key Files
- **CLI**: `index.ts`, `config.ts`
- **Web**: `app/page.tsx`, `app/api/convert/route.ts`
- **Shared**: `lib/converter/`, `config.ts`

---

**For complete details, always refer to [`AGENTS.md`](./AGENTS.md)**
