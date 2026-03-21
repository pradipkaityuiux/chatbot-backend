const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { embed, chunkText } = require("../lib/embeddings");

/**
 * POST /api/ingest
 * 
 * Protected endpoint — only you (the agency) call this during client onboarding.
 * 
 * Body:
 * {
 *   businessId: "acme-plumbing",       // Unique slug for this client
 *   content: "We offer 24/7 plumbing services...", // The raw text content
 *   source: "services-page"            // Optional label so you know where it came from
 * }
 * 
 * Headers:
 *   x-admin-secret: your_admin_secret
 */
router.post("/", async (req, res) => {
  // ── Auth check ──────────────────────────────────────────────
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { businessId, content, source = "manual" } = req.body;

  if (!businessId || !content) {
    return res.status(400).json({ error: "businessId and content are required." });
  }

  try {
    // ── Chunk the content ────────────────────────────────────
    const chunks = chunkText(content);
    console.log(`Ingesting ${chunks.length} chunks for ${businessId}...`);

    // ── Embed and store each chunk ────────────────────────────
    const rows = [];

    for (const chunk of chunks) {
      const embedding = await embed(chunk);
      rows.push({
        business_id: businessId,
        content: chunk,
        embedding,
        source,
      });
    }

    // Batch insert into Supabase
    const { error } = await supabase
      .from("knowledge_chunks")
      .insert(rows);

    if (error) throw error;

    res.json({
      success: true,
      businessId,
      chunksStored: rows.length,
      message: `Successfully stored ${rows.length} chunks for ${businessId}.`,
    });

  } catch (err) {
    console.error("Ingest error:", err);
    res.status(500).json({ error: "Failed to ingest content.", detail: err.message });
  }
});

/**
 * DELETE /api/ingest/:businessId
 * Clears all knowledge for a business — useful when a client wants a full reset.
 */
router.delete("/:businessId", async (req, res) => {
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { businessId } = req.params;

  const { error } = await supabase
    .from("knowledge_chunks")
    .delete()
    .eq("business_id", businessId);

  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true, message: `Cleared all knowledge for ${businessId}.` });
});

module.exports = router;
