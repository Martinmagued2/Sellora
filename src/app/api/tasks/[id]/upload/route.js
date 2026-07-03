/**
 * POST /api/tasks/[id]/upload
 * Upload a file attachment for a task comment.
 * Body: FormData with "file" field.
 * Returns: { url, fileName, fileSize, mimeType }
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";

let _admin = null;
function admin() {
  if (!_admin)
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  return _admin;
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: taskId } = await params;
    const db = admin();

    // Verify task access
    const { data: task } = await db
      .from("customer_tasks")
      .select("id, account_id")
      .eq("id", taskId)
      .maybeSingle();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    const hasAccess = await canAccessAccount(user, task.account_id);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Size limit: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Ensure bucket exists
    const { data: buckets } = await db.storage.listBuckets();
    const bucketNames = (buckets || []).map((b) => b.name);
    if (!bucketNames.includes("task-attachments")) {
      await db.storage.createBucket("task-attachments", {
        public: true,
        fileSizeLimit: MAX_SIZE,
      });
    }

    // Upload
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${task.account_id}/${taskId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data: uploadData, error: uploadErr } = await db.storage
      .from("task-attachments")
      .upload(fileName, file, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[TASK-UPLOAD] error:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // Get public URL
    const { data: pub } = db.storage.from("task-attachments").getPublicUrl(fileName);

    return NextResponse.json({
      url: pub.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      path: uploadData?.path,
    });
  } catch (e) {
    console.error("[TASK-UPLOAD] error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
