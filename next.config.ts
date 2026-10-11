import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // webp only: avif + webp doubled the transformations billed per static asset.
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
