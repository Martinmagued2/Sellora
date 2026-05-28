import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Lazy-init admin client
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
 * This bypasses RLS policies and is used as a fallback when client-side
 * upload fails (e.g., bucket doesn't exist yet, or RLS policies aren't set up).
 *
 * Form fields:
 *   - file: The image file (required)
 *   - path: The storage path, e.g. "{user_id}/{timestamp}.png" (required)
 *   - bucket: The bucket name (default: "product-images")
 */
export async function POST(req) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const path = formData.get("path");
    const bucket = formData.get("bucket") || "product-images";

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!path) {
      return Response.json({ error: "No path provided" }, { status: 400 });
    }

    // Security: ensure the path starts with the user's ID
    if (!path.startsWith(user.id + "/")) {
      return Response.json({ error: "Invalid path: must start with your user ID" }, { status: 403 });
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: "Invalid file type. Only images are allowed." }, { status: 400 });
    }

    // Validate file size (5MB max for product-images, 2MB for logos)
    const maxSize = bucket === "logos" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return Response.json({ error: `File too large. Max ${bucket === "logos" ? "2MB" : "5MB"}.` }, { status: 400 });
    }

    // Ensure bucket exists before upload
    const admin = getSupabaseAdmin();
    const { data: buckets } = await admin.storage.listBuckets();
    const bucketNames = (buckets || []).map((b) => b.name);

    if (!bucketNames.includes(bucket)) {
      const { error: createError } = await admin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: bucket === "logos" ? 2097152 : 5242880,
        allowedMimeTypes: bucket === "logos"
          ? ["image/png", "image/jpeg"]
          : ["image/png", "image/jpeg", "image/webp", "image/gif"],
      });
      if (createError) {
        console.error("[Storage-Upload] Failed to create bucket:", createError.message);
        return Response.json({ error: "Failed to create storage bucket: " + createError.message }, { status: 500 });
      }
      console.log(`[Storage-Upload] Created bucket: ${bucket}`);
    }

    // Upload using admin (service role) to bypass RLS
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Storage-Upload] Upload failed:", uploadError.message);
      return Response.json({ error: "Upload failed: " + uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
    const url = urlData?.publicUrl;

    return Response.json({
      success: true,
      url,
      path,
      bucket,
    });
  } catch (error) {
    console.error("[Storage-Upload] Error:", error.message);
    return Response.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
