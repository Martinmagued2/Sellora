import { NextResponse } from "next/server";

export async function GET() {
  const txt = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /api

Sitemap: https://sellorachat.com/sitemap.xml`;

  return new NextResponse(txt, {
    headers: { "Content-Type": "text/plain" },
  });
}
