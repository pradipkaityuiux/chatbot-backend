-- ================================================================
-- Run this entire file in your Supabase SQL editor (supabase.com)
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ================================================================

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;


-- ================================================================
-- TABLE: business_configs
-- One row per client. Stores branding + chatbot behavior settings.
-- ================================================================
CREATE TABLE IF NOT EXISTS business_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     TEXT UNIQUE NOT NULL,     -- e.g. "acme-plumbing"
  business_name   TEXT NOT NULL,            -- e.g. "Acme Plumbing Services"
  business_type   TEXT NOT NULL,            -- e.g. "plumbing company"

  -- Chatbot behavior
  tone            TEXT DEFAULT 'friendly',  -- friendly | professional | casual
  fallback_message TEXT,                    -- What to say when AI doesn't know
  custom_instructions TEXT,                 -- Any extra rules for this business

  -- Contact info (used in fallback messages)
  contact_email   TEXT,
  business_hours  TEXT,                     -- e.g. "Mon–Fri, 9am–6pm IST"

  -- Widget branding
  primary_color   TEXT DEFAULT '#2563eb',   -- Chat bubble + send button color
  secondary_color TEXT DEFAULT '#f1f5f9',   -- User message bubble color
  welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
  chat_bubble_label TEXT DEFAULT 'Chat with us',
  logo_url        TEXT,                     -- Optional logo in the widget header

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ================================================================
-- TABLE: knowledge_chunks
-- Stores chunked + embedded content for each business.
-- ================================================================
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   TEXT NOT NULL REFERENCES business_configs(business_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,             -- The actual text chunk
  embedding     VECTOR(1536),              -- OpenAI text-embedding-3-small produces 1536 dimensions
  source        TEXT DEFAULT 'manual',     -- Where this came from (e.g. "faq", "services-page")
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector similarity searches (HNSW = best for most cases)
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Index for filtering by business before doing vector search
CREATE INDEX IF NOT EXISTS knowledge_chunks_business_idx
  ON knowledge_chunks (business_id);


-- ================================================================
-- FUNCTION: match_chunks
-- Called from the backend to find relevant chunks for a question.
-- ================================================================
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding   VECTOR(1536),
  match_business_id TEXT,
  match_count       INT DEFAULT 4,
  match_threshold   FLOAT DEFAULT 0.70
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  source      TEXT,
  similarity  FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    kc.source,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE
    kc.business_id = match_business_id
    AND 1 - (kc.embedding <=> query_embedding) >= match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ================================================================
-- SAMPLE DATA: Insert a test client to verify everything works
-- ================================================================
INSERT INTO business_configs (
  business_id,
  business_name,
  business_type,
  tone,
  contact_email,
  business_hours,
  welcome_message,
  fallback_message,
  primary_color
) VALUES (
  'demo-plumbing',
  'Sharma Plumbing Services',
  'professional plumbing company',
  'friendly',
  'contact@sharmaplumbing.in',
  'Mon–Sat, 8am–7pm IST',
  'Hi! Welcome to Sharma Plumbing. How can I help you today?',
  'I don''t have that information handy. Please call us or email contact@sharmaplumbing.in and we''ll get back to you quickly.',
  '#1d4ed8'
) ON CONFLICT (business_id) DO NOTHING;
