import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Prepend 320 so small gallery thumbnails request a ~320px optimized
    // source instead of the 640px default minimum. Existing defaults are
    // retained; larger slots (hero/cover) still resolve to their own widths.
    deviceSizes: [320, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "s3.us-east-005.backblazeb2.com",
      },
      {
        protocol: "https",
        hostname: "media.karangtarunart016.my.id",
      },
    ],
  },
};

export default nextConfig;
