/** @type {import('next').NextConfig} */
const isVercel = !!process.env.VERCEL;
const isWindows = process.platform === "win32";

const nextConfig = {
  reactStrictMode: true,
  // Use default `.next` on Vercel so routing manifests are found.
  // Keep Windows-only distDir locally to avoid occasional filesystem lock issues.
  ...(isVercel ? {} : isWindows ? { distDir: "build_output" } : {}),
  // Environment variables are automatically loaded from .env.local
  // NEXT_PUBLIC_API_URL is available in client components
};

module.exports = nextConfig;
