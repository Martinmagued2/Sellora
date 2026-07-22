/**
 * POST /api/storage/upload
 *
 * Uploads a file to Supabase Storage and returns the public URL.
 * Used for:
 *   - Business logo uploads (ProfileTab.js)
 *   - Product image uploads (products/page.js)
 *   - Any other general-purpose file upload
 *
 * SECURITY:
 *   - Requires authentication (getAuthUser)
 *   - File size limit: 5MB
 *   - Allowed MIME types: images only (image/*)
 *   - Bucket is public-read (logos need to be visible to anyone)
 *
 * Request: multipart/form-data with a "file" field
 * Response: { url: string, path: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _admin = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _admin;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Validate MIME type — read from the File object (more reliable than client-supplied)
    const mimeType = file.type || "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `File type ${mimeType || "unknown"} not allowed. Allowed types: ${[...ALLOWED_MIME_TYPES].join(", ")}` },
        { status: 415 }
      );
    }

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique path: <userId>/<timestamp>-<random>.<ext>
    const ext = mimeType.split("/")[1] || "bin";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const filePath = `${user.id}/${fileName}`;

    const db = admin();

    // Ensure the bucket exists (create if missing, idempotent)
    try {
      await db.storage.createBucket("logos", { public: true });
    } catch (e) {
      // Bucket already exists — fine
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadErr } = await db.storage
      .from("logos")
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[STORAGE_UPLOAD] upload error:", uploadErr.message);
      return NextResponse.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });
    }

    // Get the public URL
    const { data: publicUrlData } = db.storage.from("logos").getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to get public URL" }, { status: 500 });
    }

    return NextResponse.json({
      url: publicUrl,
      path: filePath,
      size: file.size,
      type: mimeType,
    });
  } catch (e) {
    console.error("[STORAGE_UPLOAD] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
