/**
 * Knowledge Base API
 * GET    /api/knowledge-base              — list documents
 * POST   /api/knowledge-base              — create { title, content, source_type? }
 * PATCH  /api/knowledge-base/[id]         — update
 * DELETE /api/knowledge-base/[id]         — delete
 *
 * The AI agent can search these documents to quote policies, manuals,
 * shipping info, etc. that aren't in the FAQ table.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";

let _adminClient = null;
function getAdminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return _adminClient;
}

export async function GET(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("knowledge_documents")
      .select("id, title, source_type, embedding_status, is_active, created_at, updated_at")
      .eq("account_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ documents: data || [] });
  } catch (err) {
    console.error("[KB] GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, content, source_type = "text" } = await req.json();
    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Split content into chunks for retrieval (simple paragraph-based chunking)
    const chunks = chunkText(content, 500); // ~500 char chunks

    const { data, error } = await admin
      .from("knowledge_documents")
      .insert({
        account_id: user.id,
        title,
        content,
        source_type,
        chunks,
        embedding_status: "embedded", // skip real embedding for v1 (use keyword search)
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ document: data });
  } catch (err) {
    console.error("[KB] POST error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** Split text into chunks of approximately maxChars, on paragraph boundaries */
function chunkText(text, maxChars = 500) {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const chunks = [];
  let current = "";

  for (const p of paragraphs) {
    if ((current + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
