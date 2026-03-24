const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");

router.get("/:businessId", async (req, res) => {
  const { businessId } = req.params;

  const { data: config, error } = await supabase
  .from("business_configs")
  .select(
    "business_name, tone, primary_color, secondary_color, welcome_message, " +
    "chat_bubble_label, logo_url, avatar_url, theme, font_family, " +
    "bubble_style, bubble_icon, bubble_position, " +
    "show_label, show_branding, show_online_status, " +
    "chat_bg_color, bot_bubble_color, " +
    "lead_capture_enabled, lead_capture_trigger, lead_capture_after, " +
    "lead_capture_heading, lead_capture_subtext, " +
    "auto_open, auto_open_delay"
  )
  .eq("business_id", businessId)
  .single();

  if (error || !config) {
    return res.status(404).json({ error: "Business config not found." });
  }

  res.json(config);
});

module.exports = router;