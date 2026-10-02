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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          { key: "x-powered-by", value: "" },
        ],
      },
      {
        // Tight CSP: allow self + trusted CDNs only.
        // Adjust source list if you add third-party services later.
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
              "img-src 'self' data: blob: https://www.karangtarunart016.my.id https://hhvmbsjgpktblktsyijj.supabase.co https://s3.us-east-005.backblazeb2.com https://media.karangtarunart016.my.id",
              "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "connect-src 'self' https://hhvmbsjgpktblktsyijj.supabase.co https://sentry.io",
              "media-src 'self' blob:",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
