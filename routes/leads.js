const express = require("express");
const router = express.Router();
const supabase = require("../lib/supabase");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/", async (req, res) => {
  const { businessId, name, email, phone, message } = req.body;

  if (!businessId || !email) {
    return res.status(400).json({ error: "businessId and email are required." });
  }

  try {
    // 1. Save lead to Supabase
    const { data: lead, error } = await supabase
      .from("leads")
      .insert({ business_id: businessId, name, email, phone, message })
      .select()
      .single();

    if (error) throw error;

    // 2. Fetch business config to get owner's email
    const { data: config } = await supabase
      .from("business_configs")
      .select("business_name, contact_email, notification_email")
      .eq("business_id", businessId)
      .single();

    // 3. Send email notification if contact email exists
    const notifyEmail = config?.notification_email || config?.contact_email;

    if (notifyEmail && process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: "leads@drivom.in", // must be a verified domain in Resend
        to: notifyEmail,
        subject: `New lead from your chatbot — ${name || email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1e293b;">New Lead 🎉</h2>
            <p style="color: #64748b;">Someone just filled out the lead form on your chatbot.</p>

            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 8px;"><strong>Name:</strong> ${name || "Not provided"}</p>
              <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 0 0 8px;"><strong>Phone:</strong> ${phone || "Not provided"}</p>
              <p style="margin: 0;"><strong>Their message:</strong> ${message || "No message"}</p>
            </div>

            <p style="color: #64748b; font-size: 13px;">
              Reply directly to this email to respond to ${name || "this lead"}.
            </p>
          </div>
        `,
        reply_to: email, // clicking Reply in Gmail goes straight to the lead
      });
    }

    res.json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error("Lead error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:businessId", async (req, res) => {
  const secret = req.headers["x-admin-secret"] || req.query.secret;
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("business_id", req.params.businessId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ leads: data, count: data.length });
});

module.exports = router;