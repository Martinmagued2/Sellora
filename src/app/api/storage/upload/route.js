import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Lazy-init to avoid build-time errors
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _supabaseAdmin;
}

/**
 * POST /api/storage/upload
 *
 * Server-side file upload to Supabase Storage using the service role key.
 * This bypasses RLS policies, so we must validate the user ourselves.
 *
 * Expects FormData with:
 *   - file: the file to upload
 *   - path: the storage path (e.g. "{userId}/logo.png")
 *   - bucket: the bucket name (e.g. "logos", "product-images")
 */
export async function POST(request) {
  try {
    // ── 1. Validate the user via their access token ──
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    // Verify the user using the admin client
    const admin = getSupabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── 2. Parse the form data ──
    const formData = await request.formData();
    const file = formData.get("file");
    const path = formData.get("path");
    const bucket = formData.get("bucket");

    if (!file || !path || !bucket) {
      return NextResponse.json(
        { error: "Missing required fields: file, path, bucket" },
        { status: 400 }
      );
    }

    // ── 3. Validate the path belongs to this user ──
    // Path format should be: {userId}/filename.ext
    const pathParts = path.split("/");
    if (pathParts[0] !== user.id) {
      return NextResponse.json(
        { error: "Path must start with your user ID" },
        { status: 403 }
      );
    }

    // ── 4. Validate file size (2MB for logos, 5MB for product-images) ──
    const maxSizes = {
      logos: 2 * 1024 * 1024,        // 2MB
      "product-images": 5 * 1024 * 1024, // 5MB
    };
    const maxSize = maxSizes[bucket] || 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max size: ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // ── 5. Validate MIME type ──
    const allowedTypes = {
      logos: ["image/png", "image/jpeg"],
      "product-images": ["image/png", "image/jpeg", "image/webp", "image/gif"],
    };
    const allowed = allowedTypes[bucket] || ["image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not allowed for bucket ${bucket}` },
        { status: 400 }
      );
    }

    // ── 6. Ensure the bucket exists (auto-create if missing) ──
    const { data: existingBuckets, error: listError } = await admin.storage.listBuckets();
    if (listError) {
      console.error("[Storage Upload] Failed to list buckets:", listError.message);
      return NextResponse.json(
        { error: "Failed to check buckets: " + listError.message },
        { status: 500 }
      );
    }

    const bucketNames = (existingBuckets || []).map((b) => b.name);
    if (!bucketNames.includes(bucket)) {
      const { error: createError } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: maxSize,
        allowedMimeTypes: allowed,
      });
      if (createError) {
        console.error("[Storage Upload] Failed to create bucket:", createError.message);
        return NextResponse.json(
          { error: "Failed to create bucket: " + createError.message },
          { status: 500 }
        );
      }
      console.log("[Storage Upload] Created bucket:", bucket);
    }

    // ── 7. Upload the file using admin (service role) ──
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, buffer, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("[Storage Upload] Upload failed:", uploadError.message);
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    // ── 8. Get the public URL ──
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Add cache-busting timestamp so the browser doesn't serve a stale version
    const separator = publicUrl.includes("?") ? "&" : "?";
    const url = `${publicUrl}${separator}t=${Date.now()}`;

    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("[Storage Upload] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
