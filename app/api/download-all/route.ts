import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { type NextRequest, NextResponse } from "next/server";
import { fileCache } from "@/lib/cache";
import archiver from "archiver";

/**
 * POST /api/download-all
 * Create a ZIP file of multiple converted images
 *
 * Accepts JSON body with:
 * - filenames: Array of filenames to include in the ZIP
 *
 * Returns ZIP file download
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { filenames } = body as { filenames: string[] };

        if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
            return NextResponse.json({ error: "No filenames provided" }, { status: 400 });
        }

        // Validate files exist in cache
        const validFiles: string[] = [];
        for (const filename of filenames) {
            if (await fileCache.fileExists(filename)) {
                validFiles.push(filename);
            }
        }

        if (validFiles.length === 0) {
            return NextResponse.json({ error: "No valid files found" }, { status: 404 });
        }

        // Create a PassThrough stream for the ZIP output
        const { PassThrough } = await import("node:stream");
        const stream = new PassThrough();

        // Create archiver instance
        const archive = archiver("zip", {
            zlib: { level: 9 }, // Sets the compression level.
        });

        // Pipe archive data to the stream
        archive.pipe(stream);

        // Add files to archive
        for (const filename of validFiles) {
            const filePath = fileCache.getFilePath(filename);
            archive.file(filePath, { name: filename });
        }

        // Finalize the archive (this is important!)
        archive.finalize();

        // Generate a unique filename for the ZIP
        // Format: image-co-[hash 4 digit+epoch time].zip
        // Since we don't have a complex hash function handy and want to keep it simple/fast:
        // We'll use a random 4-char string + timestamp
        const randomHash = Math.random().toString(36).substring(2, 6);
        const timestamp = Date.now();
        const zipFilename = `image-co-${randomHash}${timestamp}.zip`;

        // Return the stream as response
        return new NextResponse(stream as any, {
            status: 200,
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${zipFilename}"`,
            },
        });
    } catch (error) {
        console.error("[API] Bulk download error:", error);
        return NextResponse.json(
            {
                error: "Internal server error",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
