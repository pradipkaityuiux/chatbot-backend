# AI Chatbot Backend
### For your AI agency — powers personalized chatbots for every client

---

## Setup (One-time)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in your keys in .env
```

You need:
- **Anthropic API key** → platform.anthropic.com
- **OpenAI API key** → platform.openai.com (for embeddings only)
- **Supabase project** → supabase.com (free tier works)

### 3. Set up the database
- Go to your Supabase dashboard → SQL Editor → New Query
- Paste the entire contents of `supabase-setup.sql` and hit Run
- This creates the tables, vector index, and search function

### 4. Run the server
```bash
npm run dev    # Development (auto-restarts)
npm start      # Production
```

---

## Adding a New Client

### Step 1 — Add their config to Supabase
In your Supabase dashboard → Table Editor → `business_configs` → Insert row:

| Field | Example |
|-------|---------|
| `business_id` | `raj-dental` (unique slug, lowercase, no spaces) |
| `business_name` | `Raj Dental Clinic` |
| `business_type` | `dental clinic` |
| `tone` | `professional` |
| `contact_email` | `hello@rajdental.in` |
| `business_hours` | `Mon–Sat, 10am–7pm IST` |
| `welcome_message` | `Welcome to Raj Dental! How can I help you today?` |
| `primary_color` | `#0d9488` (their brand color) |

### Step 2 — Ingest their knowledge base
Call the `/api/ingest` endpoint with their content. Do this for each section:

```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{
    "businessId": "raj-dental",
    "source": "services",
    "content": "We offer teeth cleaning, fillings, root canals, teeth whitening, and orthodontics. Our dentist Dr. Raj Mehta has 15 years of experience..."
  }'
```

Repeat for FAQs, pricing, policies, about page, etc.

### Step 3 — Give them the embed code
Send the client this one snippet to paste before `</body>` on their website:

```html
<script
  src="https://YOUR-BACKEND-DOMAIN.com/widget/chatbot.js"
  data-business-id="raj-dental"
></script>
```

Done. Their chatbot is live.

---

## API Reference

### POST /api/chat
The widget calls this automatically.
```json
{
  "businessId": "raj-dental",
  "message": "Do you do teeth whitening?",
  "history": []
}
```

### POST /api/ingest
Protected — only you call this.
```json
// Header: x-admin-secret: your_secret
{
  "businessId": "raj-dental",
  "content": "Your content here...",
  "source": "faq"
}
```

### DELETE /api/ingest/:businessId
Clears all knowledge for a business. Useful when a client does a full content update.

### GET /api/config/:businessId
Returns public branding config. Called by the widget on load.

---

## Cost Estimate per Client

| Usage | Monthly Cost (approx) |
|-------|----------------------|
| 500 customer messages/month | ~₹200–400 |
| 2000 messages/month | ~₹800–1500 |
| Embedding their knowledge base (one-time) | ~₹5–15 |

Your server hosting on Railway: ~$5/month flat for all clients combined.

---

## Deploying to Production

**Railway (recommended — simplest)**
1. Push this folder to a GitHub repo
2. Connect repo to railway.app
3. Add your `.env` variables in Railway's dashboard
4. Deploy — Railway gives you a public URL automatically

**Your domain URL becomes the widget source:**
```html
<script src="https://your-app.railway.app/widget/chatbot.js" ...></script>
```
