import type { NextConfig } from "next";

/**
 * Next.js configuration for Image Converter Web App
 * @type {NextConfig}
 */
const nextConfig: NextConfig = {
  // Set workspace root to avoid lockfile warnings
  turbopack: {
    root: __dirname,
  },
  // Use Bun as the runtime
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb", // Allow larger file uploads
    },
  },
  // Optimize for production
  poweredByHeader: false,
  compress: true,
  // Configure image optimization (we're building an image converter)
  images: {
    remotePatterns: [],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
