import type { NextConfig } from "next";

// Next.js 16 dropped the `eslint` key from NextConfig's exported type but
// still accepts it at runtime. The double-cast through `unknown` bypasses
// TypeScript's excess-property check on the object literal so the build
// doesn't fail when Vercel runs `pnpm run build` (which compiles
// next.config.ts before reading its `typescript.ignoreBuildErrors` flag).
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
} as unknown as NextConfig;

export default nextConfig;
