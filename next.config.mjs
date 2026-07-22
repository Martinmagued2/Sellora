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
    return [
      {
        // Security headers applied to ALL routes
        source: "/(.*)",
        headers: [
          // Prevent MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Referrer policy — only send origin to cross-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS — 2 years, include subdomains, preload-ready
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          // Disable unnecessary browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self), usb=()",
          },
          // Content-Security-Policy — restrictive default
          // Notes:
          //   - 'unsafe-inline' for styles is needed because Next.js injects inline styles
          //   - 'unsafe-eval' is NOT included (would allow eval())
          //   - connect-src allows Supabase, Vercel ws (HMR), and common AI/analytics domains
          //   - img-src allows data: URIs (for inline images), blob: (for object URLs),
          //     and https: (for any HTTPS-hosted images including user-uploaded)
          //   - frame-ancestors 'none' = no iframing at all (stronger than X-Frame-Options)
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-inline' https://connect.facebook.net https://js.stripe.com https://api.stripe.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https://*.supabase.co https://sellorachat.com https://www.sellorachat.com wss://*.supabase.co https://api.stripe.com https://api.openai.com https://api.groq.com https://generativelanguage.googleapis.com https://graph.facebook.com",
              "frame-src 'self' https://js.stripe.com https://www.facebook.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://secure.paymob.com https://js.stripe.com",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          // Cross-Origin isolation headers (enable SharedArrayBuffer for some libs)
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
