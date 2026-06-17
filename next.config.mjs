/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["z-ai-web-dev-sdk"],
  async redirects() {
    return [
      // /review (no token) — keep simple param-based form for now
    ];
  },
  // Vercel Cron — these run automatically when deployed on Vercel.
  // Locally they're no-ops; trigger manually via:
  //   curl -H "Authorization: Bearer $CRON_SECRET" -X POST http://localhost:3000/api/<path>
  async headers() {
    return [];
  },
};

export default nextConfig;

