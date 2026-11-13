import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint is enforced in CI / locally; don't let it block a deploy build.
  eslint: { ignoreDuringBuilds: true },
  // The service worker must never be served stale, or push fixes won't land.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
