import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "@/lib/admin-auth";

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
 * POST /api/storage/ensure-buckets
 *
 * Ensures the required Supabase Storage buckets exist with proper RLS policies.
 * This is called automatically by the app on first upload attempt,
 * but can also be called manually.
 */
export async function POST(request) {
  // 🔒 CRITICAL: Require admin auth — can create buckets & set RLS policies
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return Response.json({ error: "Unauthorized — admin access required" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // ── 1. Ensure "product-images" bucket exists ──
    const { data: existingBuckets, error: listError } = await admin.storage.listBuckets();
    if (listError) {
      console.error("[Ensure-Buckets] Failed to list buckets:", listError.message);
      return Response.json({ error: "Failed to list buckets: " + listError.message }, { status: 500 });
    }

    const bucketNames = (existingBuckets || []).map((b) => b.name);
    const results = {};

    // Create product-images bucket if missing
    if (!bucketNames.includes("product-images")) {
      const { error: createError } = await admin.storage.createBucket("product-images", {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      });
      if (createError) {
        console.error("[Ensure-Buckets] Failed to create product-images:", createError.message);
        results["product-images"] = { created: false, error: createError.message };
      } else {
        console.log("[Ensure-Buckets] Created product-images bucket");
        results["product-images"] = { created: true };
      }
    } else {
      results["product-images"] = { created: false, exists: true };
    }

    // Create logos bucket if missing
    if (!bucketNames.includes("logos")) {
      const { error: createError } = await admin.storage.createBucket("logos", {
        public: true,
        fileSizeLimit: 2097152, // 2MB
        allowedMimeTypes: ["image/png", "image/jpeg"],
      });
      if (createError) {
        console.error("[Ensure-Buckets] Failed to create logos:", createError.message);
        results["logos"] = { created: false, error: createError.message };
      } else {
        console.log("[Ensure-Buckets] Created logos bucket");
        results["logos"] = { created: true };
      }
    } else {
      results["logos"] = { created: false, exists: true };
    }

    // ── 2. Set up RLS policies using raw SQL via rpc ──
    // We use the admin client's rpc method to execute SQL that sets up policies.
    // Note: createBucket already makes the bucket public-readable if public: true,
    // but we still need RLS policies for authenticated uploads.

    const policyResults = {};

    // For product-images bucket
    try {
      // Public read access
      await admin.rpc("exec_sql", {
        sql: `
          CREATE POLICY IF NOT EXISTS "Public access to product images"
          ON storage.objects FOR SELECT
          USING (bucket_id = 'product-images');
        `,
      });
      policyResults.publicRead = "ok";
    } catch (e) {
      // If rpc exec_sql doesn't exist, that's ok — the bucket is already public
      policyResults.publicRead = "skipped (bucket is public)";
    }

    try {
      // Authenticated users can upload to their own folder
      await admin.rpc("exec_sql", {
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can upload their own product images"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'product-images'
            AND auth.uid()::text = split_part(name, '/', 1)
            AND (metadata->>'mimetype') LIKE 'image/%'
          );
        `,
      });
      policyResults.insertPolicy = "ok";
    } catch (e) {
      policyResults.insertPolicy = "skipped";
    }

    try {
      // Authenticated users can update their own images
      await admin.rpc("exec_sql", {
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can update their own product images"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (
            bucket_id = 'product-images'
            AND auth.uid()::text = split_part(name, '/', 1)
          )
          WITH CHECK (
            bucket_id = 'product-images'
            AND auth.uid()::text = split_part(name, '/', 1)
            AND (metadata->>'mimetype') LIKE 'image/%'
          );
        `,
      });
      policyResults.updatePolicy = "ok";
    } catch (e) {
      policyResults.updatePolicy = "skipped";
    }

    try {
      // Authenticated users can delete their own images
      await admin.rpc("exec_sql", {
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can delete their own product images"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'product-images'
            AND auth.uid()::text = split_part(name, '/', 1)
          );
        `,
      });
      policyResults.deletePolicy = "ok";
    } catch (e) {
      policyResults.deletePolicy = "skipped";
    }

    // For logos bucket
    try {
      await admin.rpc("exec_sql", {
        sql: `
          CREATE POLICY IF NOT EXISTS "Public access to logos"
          ON storage.objects FOR SELECT
          USING (bucket_id = 'logos');

          CREATE POLICY IF NOT EXISTS "Users can upload their own logos"
          ON storage.objects FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'logos'
            AND auth.uid()::text = split_part(name, '/', 1)
            AND (metadata->>'mimetype') LIKE 'image/%'
          );

          CREATE POLICY IF NOT EXISTS "Users can update their own logos"
          ON storage.objects FOR UPDATE
          TO authenticated
          USING (
            bucket_id = 'logos'
            AND auth.uid()::text = split_part(name, '/', 1)
          );

          CREATE POLICY IF NOT EXISTS "Users can delete their own logos"
          ON storage.objects FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'logos'
            AND auth.uid()::text = split_part(name, '/', 1)
          );
        `,
      });
      policyResults.logosPolicies = "ok";
    } catch (e) {
      policyResults.logosPolicies = "skipped";
    }

    return Response.json({
      success: true,
      buckets: results,
      policies: policyResults,
    });
  } catch (error) {
    console.error("[Ensure-Buckets] Error:", error.message);
    return Response.json(
      { error: error.message || "Failed to ensure buckets" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/storage/ensure-buckets
 *
 * Check the current state of storage buckets (doesn't create anything).
 */
export async function GET(request) {
  // 🔒 Require admin auth for bucket listing too
  const { isAdmin } = await verifyAdmin(request);
  if (!isAdmin) {
    return Response.json({ error: "Unauthorized — admin access required" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: buckets, error } = await admin.storage.listBuckets();
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    const bucketNames = (buckets || []).map((b) => b.name);
    return Response.json({
      buckets: bucketNames,
      hasProductImages: bucketNames.includes("product-images"),
      hasLogos: bucketNames.includes("logos"),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
