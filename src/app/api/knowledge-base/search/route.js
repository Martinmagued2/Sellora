/**
 * POST /api/knowledge-base/search
 * Semantic search over the knowledge base using embeddings.
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { resolveEffectiveAccount } from "@/lib/team-auth";
import { searchKnowledgeBase } from "@/lib/ai/rag";

export async function POST(req) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { effectiveAccountId } = await resolveEffectiveAccount(user);
    if (!effectiveAccountId) return NextResponse.json({ error: "No account found" }, { status: 404 });

    const { query, limit } = await req.json();
    if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 });

    const results = await searchKnowledgeBase(query, effectiveAccountId, limit || 5);

    return NextResponse.json({ results, count: results.length });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
