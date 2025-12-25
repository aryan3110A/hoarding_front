/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workaround: in some Windows setups .next/trace can be blocked by permissions/locks.
  // Using a custom distDir avoids reusing a problematic folder.
  // NOTE: This Windows environment denies writes to Next's default trace file when distDir is named
  // ".next" / "next-build". Using a neutral folder name keeps builds working.
  distDir: "build_output",
  // Environment variables are automatically loaded from .env.local
  // NEXT_PUBLIC_API_URL is available in client components
};

module.exports = nextConfig;
