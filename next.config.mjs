/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["z-ai-web-dev-sdk"],
  // For Capacitor mobile app: static export needed for capacitor.config.ts webDir: 'out'
  // Uncomment when building the mobile app:
  // output: "export",
  // images: { unoptimized: true },
  async redirects() {
    return [];
  },
  async headers() {
    return [];
  },
};

export default nextConfig;

