const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");

// ── Auth middleware for all admin routes ──────────────────────
function requireAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"] || req.query.secret;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

router.use(requireAdmin);

/**
 * GET /api/admin/clients
 * Returns all business configs with chunk counts
 */
router.get("/clients", async (req, res) => {
  try {
    const { data: clients, error } = await supabase
      .from("business_configs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get chunk counts per business
    const { data: chunkCounts } = await supabase
      .from("knowledge_chunks")
      .select("business_id")
      .in("business_id", clients.map((c) => c.business_id));

    // Map chunk counts to clients
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

/**
 * POST /api/admin/clients
 * Create a new business config
 */
router.post("/clients", async (req, res) => {
  const {
    business_id, business_name, business_type, tone,
    contact_email, notification_email, business_hours,
    welcome_message, fallback_message, primary_color,
    secondary_color, chat_bubble_label, custom_instructions,
    // Widget appearance
    theme, font_family, chat_bg_color, bot_bubble_color,
    bubble_style, bubble_icon, bubble_position,
    logo_url, avatar_url,
    show_label, show_branding, show_online_status,
    // Lead capture
    lead_capture_enabled, lead_capture_trigger,
    lead_capture_after, lead_capture_heading, lead_capture_subtext,
  } = req.body;

  if (!business_id || !business_name) {
    return res.status(400).json({ error: "business_id and business_name are required." });
  }

  const safeId = business_id.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const { data, error } = await supabase
    .from("business_configs")
    .insert({
      // Business info
      business_id: safeId,
      business_name,
      business_type: business_type || "business",
      tone: tone || "friendly",
      contact_email,
      notification_email,
      business_hours,
      welcome_message: welcome_message || `Hi! Welcome to ${business_name}. How can I help you?`,
      fallback_message,
      primary_color: primary_color || "#2563eb",
      secondary_color: secondary_color || "#f1f5f9",
      chat_bubble_label: chat_bubble_label || "Chat with us",
      custom_instructions,
      // Widget appearance
      theme: theme || "light",
      font_family: font_family || "system",
      chat_bg_color: chat_bg_color || null,
      bot_bubble_color: bot_bubble_color || null,
      bubble_style: bubble_style || "circle",
      bubble_icon: bubble_icon || "chat",
      bubble_position: bubble_position || "right",
      logo_url: logo_url || null,
      avatar_url: avatar_url || null,
      show_label: show_label !== undefined ? show_label : true,
      show_branding: show_branding !== undefined ? show_branding : true,
      show_online_status: show_online_status !== undefined ? show_online_status : true,
      // Lead capture
      lead_capture_enabled: lead_capture_enabled || false,
      lead_capture_trigger: lead_capture_trigger || "after_messages",
      lead_capture_after: lead_capture_after || 3,
      lead_capture_heading: lead_capture_heading || "Before I continue...",
      lead_capture_subtext: lead_capture_subtext || "Leave your details and we'll follow up personally.",
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

/**
 * PUT /api/admin/clients/:businessId
 * Update a client's config
 */
router.put("/clients/:businessId", async (req, res) => {
  const { businessId } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.business_id; // Don't allow changing the ID

  const { data, error } = await supabase
    .from("business_configs")
    .update(updates)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ client: data });
});

/**
 * DELETE /api/admin/clients/:businessId
 * Removes client config AND all their knowledge chunks (cascade)
 */
router.delete("/clients/:businessId", async (req, res) => {
  const { businessId } = req.params;

  const { error } = await supabase
    .from("business_configs")
    .delete()
    .eq("business_id", businessId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

/**
 * GET /api/admin/clients/:businessId/chunks
 * List knowledge chunks for a client (for review/debugging)
 */
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