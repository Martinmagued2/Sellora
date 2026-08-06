-- 075_rag_embeddings.sql
-- Vector embeddings for knowledge base documents (RAG).
-- Uses pgvector extension for semantic search.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS embedding_chunks JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_embedding
  ON knowledge_documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;
