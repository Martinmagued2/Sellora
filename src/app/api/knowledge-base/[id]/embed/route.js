/**
 * POST /api/knowledge-base/[id]/embed
 * Generates and stores an embedding for a knowledge base document.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth-helper";
import { canAccessAccount } from "@/lib/team-auth";
import { generateEmbedding } from "@/lib/ai/rag";

let _admin = null;
function admin() {
  if (!_admin) _admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _admin;
}

export async function POST(req, { params }) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = admin();
    const { data: doc } = await db
      .from("knowledge_documents")
      .select("id, account_id, title, content")
      .eq("id", params.id)
      .maybeSingle();

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const hasAccess = await canAccessAccount(user, doc.account_id);
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const embedding = await generateEmbedding(`${doc.title} ${doc.content}`);

    if (!embedding) {
      return NextResponse.json({ error: "Failed to generate embedding" }, { status: 500 });
    }

    const { error } = await db
      .from("knowledge_documents")
      .update({ embedding, embedding_status: "completed" })
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, dimensions: embedding.length });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
