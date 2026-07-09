/** GET /api/push/vapid-key — returns the VAPID public key for client subscription */
import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push/web-push";

export async function GET() {
  const key = await getVapidPublicKey();
  if (!key) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({ configured: true, publicKey: key });
}
