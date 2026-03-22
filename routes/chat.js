const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const supabase = require("../lib/supabase");
const { embed } = require("../lib/embeddings");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Config cache — avoids Supabase hit on every request ───────
const configCache = new Map(); // { businessId: { data: config, cachedAt: timestamp } }
const invalidAttempts = new Map(); // { ip: count }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.post("/", async (req, res) => {
  const { businessId, message, history = [] } = req.body;

  if (!businessId || !message) {
    return res.status(400).json({ error: "businessId and message are required." });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: "Message too long." });
  }

  try {
    // ── Step 1: Fetch business config (with cache) ────────────
    let config = null;
    const cached = configCache.get(businessId);

    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      // Serve from cache — no DB hit
      config = cached.data;
    } else {
      // Cache miss or expired — fetch from Supabase
      const { data, error: configError } = await supabase
        .from("business_configs")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (configError || !data) {
        // Track invalid businessId attempts per IP
        const ip = req.ip;
        const attempts = (invalidAttempts.get(ip) || 0) + 1;
        invalidAttempts.set(ip, attempts);

        // Block IP after 5 invalid attempts
        if (attempts >= 5) {
          return res.status(429).json({ error: "Too many invalid requests." });
        }

        return res.status(404).json({ error: "Business not found." });
      }

      config = data;
      configCache.set(businessId, { data: config, cachedAt: Date.now() });
    }

    // ── Step 2: Embed the question ───────────────────────────
    const questionEmbedding = await embed(message);

    // ── Step 3: Vector search with retry ─────────────────────
    // Lower threshold on first message — cold queries need more room
    const isFirstMessage = history.length === 0;
    const threshold = isFirstMessage ? 0.25 : 0.45;

    let chunks = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await supabase.rpc("match_chunks", {
        query_embedding: questionEmbedding,
        match_business_id: businessId,
        match_count: 4,
        match_threshold: threshold,
      });

      if (result.error) throw result.error;

      if (result.data && result.data.length > 0) {
        chunks = result.data;
        break;
      }

      if (attempt === 1) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    if (!chunks || chunks.length === 0) {
      console.log(`[Chat] WARNING: No context found for "${message}" | businessId: ${businessId}`);
    }

    // ── Step 4: Build context string ─────────────────────────
    const context = chunks && chunks.length > 0
      ? chunks.map((c) => c.content).join("\n\n---\n\n")
      : null;

    // ── Step 5: Build system prompt ───────────────────────────
    const systemPrompt = buildSystemPrompt(config, context);

    // ── Step 6: Build message history ────────────────────────
    const recentHistory = history.slice(-6).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const messages = [
      ...recentHistory,
      { role: "user", content: message },
    ];

    // ── Step 7: Call Claude ───────────────────────────────────
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const reply = response.content[0].text;

    res.json({
      reply,
      businessId,
      hasContext: chunks && chunks.length > 0,
    });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      error: "Something went wrong. Please try again.",
      detail: err.message,
    });
  }
});

function buildSystemPrompt(config, context) {
  const {
    business_name,
    business_type,
    tone,
    fallback_message,
    contact_email,
    business_hours,
    custom_instructions,
  } = config;

  return `You are a customer support assistant for ${business_name}, a ${business_type}.

PERSONALITY & TONE:
Communicate in a ${tone} tone. Be helpful, clear, and concise.
Keep responses short — 2 to 4 sentences unless the question needs more detail.
Never use bullet points unless the customer is asking for a list.

${context
  ? `KNOWLEDGE BASE — use this to answer the customer's question:
"""
${context}
"""

IMPORTANT: Use the knowledge base above to answer. If the answer is not stated directly,
use logical reasoning from what you do know. For example if you know the business is
based in Pune, Maharashtra, you can correctly answer that it is located in India.
Only use the fallback response if the question is completely unrelated to the business
and cannot be reasonably inferred from any available information.`
  : `No specific knowledge found for this question.`}

FALLBACK RULE:
If you don't know the answer or the question is outside your knowledge, say exactly this:
"${fallback_message || `I don't have that information right now. Please reach out to us at ${contact_email || "our team"} and we'll get back to you shortly.`}"

BUSINESS DETAILS:
- Name: ${business_name}
- Hours: ${business_hours || "Please contact us for hours"}
- Contact: ${contact_email || "Not provided"}

${custom_instructions ? `CUSTOM INSTRUCTIONS:\n${custom_instructions}` : ""}

Never make up information. Never pretend to be a human if directly asked. Never discuss competitors.`;
}

module.exports = router;