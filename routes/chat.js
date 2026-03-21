const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const supabase = require("../lib/supabase");
const { embed } = require("../lib/embeddings");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/chat
 * 
 * Called by the widget on the client's website.
 * 
 * Body:
 * {
 *   businessId: "acme-plumbing",
 *   message: "Do you offer emergency services?",
 *   history: [                          // Optional — last few messages for context
 *     { role: "user", content: "Hello" },
 *     { role: "assistant", content: "Hi! How can I help?" }
 *   ]
 * }
 */
router.post("/", async (req, res) => {
  const { businessId, message, history = [] } = req.body;

  if (!businessId || !message) {
    return res.status(400).json({ error: "businessId and message are required." });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: "Message too long." });
  }

  try {
    // ── Step 1: Fetch this business's config ─────────────────
    const { data: config, error: configError } = await supabase
      .from("business_configs")
      .select("*")
      .eq("business_id", businessId)
      .single();

    if (configError || !config) {
      return res.status(404).json({ error: "Business not found." });
    }

    // ── Step 2: Embed the customer's question ────────────────
    const questionEmbedding = await embed(message);

    // ── Step 3: Find the most relevant knowledge chunks ──────
    const { data: chunks, error: searchError } = await supabase.rpc(
      "match_chunks",
      {
        query_embedding: questionEmbedding,
        match_business_id: businessId,
        match_count: 4,        // Top 4 most relevant chunks
        match_threshold: 0.4, // Minimum similarity score
      }
    );

    if (searchError) throw searchError;

    // ── Step 4: Build the context string ─────────────────────
    const context = chunks && chunks.length > 0
      ? chunks.map((c) => c.content).join("\n\n---\n\n")
      : null;

    // ── Step 5: Build the system prompt ──────────────────────
    const systemPrompt = buildSystemPrompt(config, context);

    // ── Step 6: Build conversation history for Claude ────────
    // Keep last 6 messages to stay within a reasonable context window
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
      // Return whether we found relevant knowledge (useful for debugging)
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

/**
 * Builds the system prompt dynamically per business.
 * This is what makes each chatbot feel unique to that brand.
 */
function buildSystemPrompt(config, context) {
  const {
    business_name,
    business_type,
    tone,           // "friendly" | "professional" | "casual"
    primary_color,  // Not used here but stored for the widget
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

${context ? `KNOWLEDGE BASE — use this to answer the customer's question:
"""
${context}
"""

IMPORTANT: Use the knowledge base above to answer. If the answer isn't stated directly, 
use logical reasoning from what you do know. For example, if you know the business is 
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
