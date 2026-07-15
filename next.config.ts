import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint is enforced in CI / locally; don't let it block a deploy build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
