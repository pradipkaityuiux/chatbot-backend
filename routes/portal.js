const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");

// Verify client token and return their business_id
router.get("/verify/:token", async (req, res) => {
  const { data, error } = await supabase
    .from("business_configs")
    .select("business_id, business_name")
    .eq("client_token", req.params.token)
    .single();

  if (error || !data) return res.status(401).json({ error: "Invalid token." });
  res.json(data);
});

// Get leads for a client using their token
router.get("/leads/:token", async (req, res) => {
  const { data: config, error: configError } = await supabase
    .from("business_configs")
    .select("business_id, business_name")
    .eq("client_token", req.params.token)
    .single();

  if (configError || !config) {
    return res.status(401).json({ error: "Invalid token." });
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, message, created_at")
    .eq("business_id", config.business_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    business_name: config.business_name,
    leads,
    count: leads.length
  });
});

// Get knowledge chunks for a client using their token
router.get("/knowledge/:token", async (req, res) => {
  const { data: config, error: configError } = await supabase
    .from("business_configs")
    .select("business_id, business_name")
    .eq("client_token", req.params.token)
    .single();

  if (configError || !config) {
    return res.status(401).json({ error: "Invalid token." });
  }

  const { data: chunks, error } = await supabase
    .from("knowledge_chunks")
    .select("id, content, source, created_at")
    .eq("business_id", config.business_id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ chunks, count: chunks.length });
});

module.exports = router;