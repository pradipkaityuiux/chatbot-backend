const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");

function requireAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"] || req.query.secret;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireAdmin);

router.get("/clients", async (req, res) => {
  try {
    const { data: clients, error } = await supabase
      .from("business_configs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const { data: chunkCounts } = await supabase
      .from("knowledge_chunks")
      .select("business_id")
      .in("business_id", clients.map((c) => c.business_id));

    const countMap = {};
    (chunkCounts || []).forEach((row) => {
      countMap[row.business_id] = (countMap[row.business_id] || 0) + 1;
    });

    const enriched = clients.map((c) => ({
      ...c,
      chunk_count: countMap[c.business_id] || 0,
    }));

    res.json({ clients: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/clients", async (req, res) => {
  const {
    business_id, business_name, business_type, tone,
    contact_email, business_hours, welcome_message,
    fallback_message, primary_color, secondary_color,
    chat_bubble_label, custom_instructions,
  } = req.body;

  if (!business_id || !business_name) {
    return res.status(400).json({ error: "business_id and business_name are required." });
  }

  const safeId = business_id.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const { data, error } = await supabase
    .from("business_configs")
    .insert({
      business_id: safeId,
      business_name,
      business_type: business_type || "business",
      tone: tone || "friendly",
      contact_email,
      business_hours,
      welcome_message: welcome_message || `Hi! Welcome to ${business_name}. How can I help you?`,
      fallback_message,
      primary_color: primary_color || "#2563eb",
      secondary_color: secondary_color || "#f1f5f9",
      chat_bubble_label: chat_bubble_label || "Chat with us",
      custom_instructions,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "A client with this ID already exists." });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ client: data });
});

router.put("/clients/:businessId", async (req, res) => {
  const { businessId } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.business_id;

  const { data, error } = await supabase
    .from("business_configs")
    .update(updates)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ client: data });
});

router.delete("/clients/:businessId", async (req, res) => {
  const { businessId } = req.params;

  const { error } = await supabase
    .from("business_configs")
    .delete()
    .eq("business_id", businessId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

router.get("/clients/:businessId/chunks", async (req, res) => {
  const { businessId } = req.params;

  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id, content, source, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ chunks: data, count: data.length });
});

module.exports = router;