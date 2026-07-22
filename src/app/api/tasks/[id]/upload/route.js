/**
 * POST /api/tasks/[id]/upload
 *
 * Uploads a file attachment for a task and returns the public URL.
 * The URL is then used when posting a comment with the attachment via
 * /api/tasks/[id]/comments.
 *
 * SECURITY:
 *   - Requires authentication (getAuthUser)
 *   - Verifies the task exists + the user can access the task's account
 *   - File size limit: 10MB (task attachments can be larger than logos)
 *   - Allowed MIME types: images, PDFs, common document formats
 *
 * Request: multipart/form-data with a "file" field
 * Response: { url: string, path: string, fileName: string, fileSize: number, fileType: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/markdown",
  "application/zip", "application/x-zip-compressed",
]);

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskId = params.id;
    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 });
    }

    const db = admin();

    // Verify the task exists + the user can access the task's account
    const { data: task, error: taskErr } = await db
      .from("customer_tasks")
      .select("id, account_id, customer_id, title")
      .eq("id", taskId)
      .maybeSingle();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // SECURITY: Verify the user can access this account (owner or team member)
    const hasAccess = await canAccessAccount(user, task.account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: "You do not have access to this task" }, { status: 403 });
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

    // Validate MIME type
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `File type ${mimeType} not allowed.` },
        { status: 415 }
      );
    }

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique path: task-attachments/<taskId>/<timestamp>-<filename>
    const safeFileName = (file.name || "attachment").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const fileName = `${Date.now()}-${safeFileName}`;
    const filePath = `${taskId}/${fileName}`;

    // Ensure the bucket exists
    try {
      await db.storage.createBucket("task-attachments", { public: true });
    } catch (e) {
      // Bucket already exists — fine
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadErr } = await db.storage
      .from("task-attachments")
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[TASK_UPLOAD] upload error:", uploadErr.message);
      return NextResponse.json({ error: "Upload failed: " + uploadErr.message }, { status: 500 });
    }

    // Get the public URL
    const { data: publicUrlData } = db.storage.from("task-attachments").getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json({ error: "Failed to get public URL" }, { status: 500 });
    }

    return NextResponse.json({
      url: publicUrl,
      path: filePath,
      fileName: file.name || safeFileName,
      fileSize: file.size,
      fileType: mimeType,
    });
  } catch (e) {
    console.error("[TASK_UPLOAD] error:", e.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
