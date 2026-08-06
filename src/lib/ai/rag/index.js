/**
 * RAG (Retrieval-Augmented Generation) utilities.
 *
 * - generateEmbedding(text): creates a 1536-dim embedding using OpenAI
 * - searchKnowledgeBase(query, accountId): semantic search over knowledge_documents
 * - augmentPromptWithContext(query, accountId): returns relevant KB chunks for the AI prompt
 */

import { createClient } from "@supabase/supabase-js";

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

/**
 * Generate an embedding for a text using OpenAI's text-embedding-3-small model.
 * Falls back to a simple hash-based pseudo-embedding if no OpenAI key is available.
 *
 * @param {string} text
 * @returns {Promise<number[]>} 1536-dimensional vector
 */
export async function generateEmbedding(text) {
  if (!text || text.trim().length < 5) return null;

  // Try OpenAI embeddings
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: text.slice(0, 8000),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.[0]?.embedding || null;
      }
    } catch (e) {
      console.warn("[RAG] OpenAI embedding failed:", e.message);
    }
  }

  // Try OpenRouter embeddings (some models support it)
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/text-embedding-3-small",
          input: text.slice(0, 8000),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.data?.[0]?.embedding || null;
      }
    } catch (e) {
      console.warn("[RAG] OpenRouter embedding failed:", e.message);
    }
  }

  // Fallback: pseudo-embedding (deterministic hash-based)
  // Not as good as real embeddings, but allows basic similarity matching
  return generatePseudoEmbedding(text);
}

/**
 * Generate a pseudo-embedding using character frequency analysis.
 * This is a fallback when no embedding API is available.
 */
function generatePseudoEmbedding(text) {
  const embedding = new Array(1536).fill(0);
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const charCode = lower.charCodeAt(i);
    embedding[charCode % 1536] += 1;
    if (i + 1 < lower.length) {
      embedding[(charCode + lower.charCodeAt(i + 1)) % 1536] += 0.5;
    }
  }
  // Normalize
  const max = Math.max(...embedding, 1);
  return embedding.map(v => v / max);
}

/**
 * Search the knowledge base using semantic similarity.
 *
 * @param {string} query — the search query
 * @param {string} accountId — the account to search within
 * @param {number} limit — max results (default 5)
 * @returns {Promise<Array<{id, title, content, similarity}>>}
 */
export async function searchKnowledgeBase(query, accountId, limit = 5) {
  if (!query || !accountId) return [];

  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  const db = admin();

  // Try pgvector similarity search
  try {
    const { data, error } = await db.rpc("match_knowledge_documents", {
      query_embedding: queryEmbedding,
      match_account_id: accountId,
      match_limit: limit,
    });

    if (!error && data) {
      return data.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        similarity: doc.similarity,
      }));
    }
  } catch (e) {
    console.warn("[RAG] pgvector search failed, falling back to text search:", e.message);
  }

  // Fallback: text search (ilike)
  const { data: docs } = await db
    .from("knowledge_documents")
    .select("id, title, content")
    .eq("account_id", accountId)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(limit);

  return (docs || []).map(doc => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    similarity: 0.5, // placeholder
  }));
}

/**
 * Augment an AI system prompt with relevant knowledge base context.
 *
 * @param {string} userMessage — the customer's message
 * @param {string} accountId — the account ID
 * @returns {Promise<string>} additional context to append to the system prompt
 */
export async function augmentPromptWithContext(userMessage, accountId) {
  const results = await searchKnowledgeBase(userMessage, accountId, 3);

  if (!results || results.length === 0) return "";

  let context = "\n\n═══ KNOWLEDGE BASE (from your documents) ═══\n";
  context += "Use this information to answer the customer's question. If the answer is here, use it directly.\n\n";

  for (const doc of results) {
    context += `📄 ${doc.title} (relevance: ${Math.round(doc.similarity * 100)}%)\n`;
    context += `${doc.content.slice(0, 500)}${doc.content.length > 500 ? "..." : ""}\n\n`;
  }

  return context;
}
