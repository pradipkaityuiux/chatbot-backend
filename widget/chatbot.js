/**
 * AI Chatbot Widget — v2 with full theming support
 *
 * HOW TO EMBED:
 * <script
 *   src="https://your-backend.com/widget/chatbot.js"
 *   data-business-id="your-client-id"
 * ></script>
 *
 * All customization is controlled from the business_configs table.
 * No code changes needed per client — ever.
 */

(function () {
  "use strict";

  const scriptTag = document.currentScript;
  const BUSINESS_ID = scriptTag?.getAttribute("data-business-id");
  const API_BASE = scriptTag?.src
    ? new URL(scriptTag.src).origin
    : "http://localhost:3001";

  if (!BUSINESS_ID) {
    console.warn("[Chatbot] No data-business-id found on script tag.");
    return;
  }

  let isOpen = false;
  let isLoading = false;
  let conversationHistory = [];
  let messageCount = 0;
  let leadCaptured = false;

  let config = {
    business_name: "Support",
    welcome_message: "Hi! How can I help you today?",
    chat_bubble_label: "Chat with us",
    logo_url: null,
    avatar_url: null,
    theme: "light",
    primary_color: "#2563eb",
    secondary_color: "#f1f5f9",
    font_family: "system",
    bubble_style: "circle",
    bubble_icon: "chat",
    bubble_position: "right",
    show_label: true,
    show_branding: true,
    show_online_status: true,
    chat_bg_color: null,
    bot_bubble_color: null,
    lead_capture_enabled: false,
    lead_capture_trigger: 'after_messages',
    lead_capture_after: 3,
    lead_capture_heading: 'Before I continue...',
    lead_capture_subtext: 'Leave your details and we\'ll follow up personally.',
    auto_open: false,
    auto_open_delay: 3,
  };

  const fontMap = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', Courier, monospace",
  };

  const iconMap = {
    chat: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    question: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    smile: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
    headset: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
  };

  function buildThemeVars() {
    const dark = config.theme === "dark";
    const font = fontMap[config.font_family] || fontMap.system;
    return `
      --cb-primary: ${config.primary_color};
      --cb-secondary: ${config.secondary_color};
      --cb-font: ${font};
      --cb-bg: ${config.chat_bg_color || (dark ? "#1a1a2e" : "#ffffff")};
      --cb-surface: ${dark ? "#16213e" : "#f8fafc"};
      --cb-border: ${dark ? "#2a2a45" : "#e2e8f0"};
      --cb-text: ${dark ? "#e8e8f0" : "#1e293b"};
      --cb-text-dim: ${dark ? "#e3e8f4" : "#373a3f"};
      --cb-user-bubble: ${config.primary_color};
      --cb-user-text: #ffffff;
      --cb-bot-bubble: ${config.bot_bubble_color || (dark ? "#0f3460" : config.secondary_color)};
      --cb-bot-text: ${dark ? "#e8e8f0" : "#1e293b"};
      --cb-input-bg: ${dark ? "#0f0f1a" : "#ffffff"};
      --cb-shadow: ${dark ? "0 8px 40px rgba(0,0,0,0.5)" : "0 8px 40px rgba(0,0,0,0.15)"};
    `;
  }

  function injectStyles() {
    const dark = config.theme === "dark";
    const isLeft = config.bubble_position === "left";
    const isSquare = config.bubble_style === "rounded-square";
    const style = document.createElement("style");
    style.textContent = `
      #cb-widget { ${buildThemeVars()} font-family: var(--cb-font); }
      #cb-widget * { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--cb-font); }
      #cb-bubble {
        position: fixed; bottom: 24px;
        ${isLeft ? "left: 24px;" : "right: 24px;"}
        z-index: 99998;
        display: flex; align-items: center;
        flex-direction: ${isLeft ? "row" : "row-reverse"};
        gap: 10px; cursor: pointer;
        animation: cb-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      #cb-bubble-btn { width: 58px; height: 58px; border-radius: ${isSquare ? "16px" : "50%"}; border: none; background: var(--cb-primary); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.25); transition: transform 0.2s, box-shadow 0.2s; flex-shrink: 0; overflow: hidden; padding: 0; animation: cb-shake 2.5s ease-in-out 3s infinite; }
      #cb-bubble-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.3); }
      #cb-bubble-btn img { width: 100%; height: 100%; object-fit: cover; }
      #cb-bubble-btn .cb-emoji { font-size: 26px; line-height: 1; }
      #cb-bubble-label {
        background: var(--cb-bg); color: var(--cb-text);
        padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
        box-shadow: 0 2px 12px rgba(0,0,0,0.12); white-space: nowrap;
        border: 1px solid var(--cb-border); transition: opacity 0.2s;
      }
      #cb-window {
        position: fixed; bottom: 94px;
        ${isLeft ? "left: 24px;" : "right: 24px;"}
        width: 360px; height: 530px;
        background: var(--cb-bg); border-radius: 18px;
        box-shadow: var(--cb-shadow); border: 1px solid var(--cb-border);
        display: flex; flex-direction: column; overflow: hidden;
        z-index: 99999;
        transform: scale(0.85) translateY(20px); opacity: 0; pointer-events: none;
        transition: transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.22s;
        transform-origin: ${isLeft ? "bottom left" : "bottom right"};
      }
      #cb-window.cb-open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
      #cb-header {
        background: var(--cb-primary); color: white;
        padding: 16px 18px; display: flex; align-items: center; gap: 12px; flex-shrink: 0;
      }
      #cb-header-avatar {
        width: 38px; height: 38px; border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; flex-shrink: 0; overflow: hidden; font-weight: 700; color: white;
      }
      #cb-header-avatar img { width: 100%; height: 100%; object-fit: cover; }
      #cb-header-info { flex: 1; }
      #cb-header-name { font-weight: 600; font-size: 15px; }
      #cb-header-status { font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 5px; margin-top: 2px; }
      .cb-status-dot { width: 7px; height: 7px; background: #4ade80; border-radius: 50%; display: inline-block; animation: cb-pulse 2s infinite; }
      #cb-close-btn {
        background: rgba(255,255,255,0.15); border: none; color: white;
        width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
        font-size: 16px; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s; flex-shrink: 0;
      }
      #cb-close-btn:hover { background: rgba(255,255,255,0.28); }
      #cb-messages {
        flex: 1; overflow-y: auto; padding: 16px;
        display: flex; flex-direction: column; gap: 10px;
        scroll-behavior: smooth; background: var(--cb-bg);
      }
      #cb-messages::-webkit-scrollbar { width: 4px; }
      #cb-messages::-webkit-scrollbar-thumb { background: var(--cb-border); border-radius: 4px; }
      .cb-msg { display: flex; flex-direction: column; max-width: 82%; animation: cb-msg-in 0.2s ease; }
      .cb-msg-bot { align-self: flex-start; }
      .cb-msg-user { align-self: flex-end; }
      .cb-bubble-text { padding: 10px 14px !important; border-radius: 14px; font-size: 14px; line-height: 1.55; word-wrap: break-word; }
      .cb-msg-bot .cb-bubble-text { background: var(--cb-bot-bubble); color: var(--cb-bot-text); border-bottom-left-radius: 4px; }
      .cb-msg-user .cb-bubble-text { background: var(--cb-user-bubble); color: var(--cb-user-text); border-bottom-right-radius: 4px; }
      .cb-typing { display: flex; align-items: center; gap: 5px; padding: 12px 14px; border-radius: 14px; border-bottom-left-radius: 4px; width: fit-content; }
.cb-typing span { width: 7px; height: 7px; background: ${dark ? "#ffffff" : "#0f0f1a"}; border-radius: 50%; animation: cb-bounce 1.2s infinite; opacity: 0.8; }
      .cb-typing span:nth-child(2) { animation-delay: 0.2s; }
      .cb-typing span:nth-child(3) { animation-delay: 0.4s; }
      #cb-input-area { padding: 12px; border-top: 1px solid var(--cb-border); display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; background: var(--cb-bg); }
      #cb-input { flex: 1; border: 1.5px solid var(--cb-border); border-radius: 10px; padding: 10px 12px; font-size: 14px; resize: none; outline: none; max-height: 100px; min-height: 40px; line-height: 1.4; color: var(--cb-text); background: var(--cb-input-bg); transition: border-color 0.2s; }
      #cb-input:focus { border-color: var(--cb-primary); }
      #cb-input::placeholder { color: var(--cb-text-dim); }
      #cb-send { background: var(--cb-primary); color: white; border: none; width: 38px; height: 38px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s, transform 0.1s; flex-shrink: 0; }
      #cb-send:hover { opacity: 0.88; transform: scale(1.05); }
      #cb-send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      #cb-footer { text-align: center; padding: 5px 0 10px; font-size: 11px; color: var(--cb-text-dim); background: var(--cb-bg); flex-shrink: 0; }
      @keyframes cb-pop-in { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes cb-shake { 0%, 100% { transform: rotate(0deg); } 15% { transform: rotate(-8deg); } 30% { transform: rotate(8deg); } 45% { transform: rotate(-6deg); } 60% { transform: rotate(6deg); } 75% { transform: rotate(-3deg); } 90% { transform: rotate(3deg); } }
      @keyframes cb-msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes cb-bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      @keyframes cb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      @media (max-width: 420px) {
        #cb-window { width: calc(100vw - 24px); ${isLeft ? "left: 12px;" : "right: 12px;"} bottom: 82px; height: 480px; }
        #cb-bubble { ${isLeft ? "left: 16px;" : "right: 16px;"} bottom: 16px; }
      }
    `;
    document.head.appendChild(style);
  }

  function showLeadForm() {
    if (leadCaptured) return;
    const messagesEl = document.getElementById("cb-messages");
    const form = document.createElement("div");
    form.id = "cb-lead-form";
    form.className = "cb-msg cb-msg-bot";
    form.style.maxWidth = "100%";
    form.innerHTML = `
      <div style="
        background: var(--cb-bot-bubble);
        border: 1px solid var(--cb-border);
        border-radius: 14px;
        border-bottom-left-radius: 4px;
        padding: 16px;
        width: 100%;
      ">
        <div style="font-weight: 600; font-size: 14px; color: var(--cb-text); margin-bottom: 4px;">
          ${config.lead_capture_heading}
        </div>
        <div style="font-size: 12px; color: var(--cb-text-dim); margin-bottom: 12px;">
          ${config.lead_capture_subtext}
        </div>
        <input id="cb-lead-name" placeholder="Your name"
          style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cb-border);
          background:var(--cb-input-bg); color:var(--cb-text); font-size:13px; margin-bottom:8px; outline:none;" />
        <input id="cb-lead-email" placeholder="Email address" type="email"
          style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cb-border);
          background:var(--cb-input-bg); color:var(--cb-text); font-size:13px; margin-bottom:8px; outline:none;" />
        <input id="cb-lead-phone" placeholder="Phone number (optional)"
          style="width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--cb-border);
          background:var(--cb-input-bg); color:var(--cb-text); font-size:13px; margin-bottom:10px; outline:none;" />
        <button id="cb-lead-submit"
          style="width:100%; background:var(--cb-primary); color:white; border:none;
          padding:9px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">
          Send My Details →
        </button>
      </div>
    `;
    messagesEl.appendChild(form);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    document.getElementById("cb-lead-submit").addEventListener("click", submitLead);
  }

  async function submitLead() {
    const name = document.getElementById("cb-lead-name")?.value.trim();
    const email = document.getElementById("cb-lead-email")?.value.trim();
    const phone = document.getElementById("cb-lead-phone")?.value.trim();

    if (!email) {
      document.getElementById("cb-lead-email").style.borderColor = "red";
      return;
    }

    try {
      await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: BUSINESS_ID,
          name, email, phone,
          message: conversationHistory.slice(-1)[0]?.content || ""
        }),
      });

      // Replace form with thank you message
      const form = document.getElementById("cb-lead-form");
      if (form) {
        form.innerHTML = `
          <div class="cb-bubble-text" style="background:var(--cb-bot-bubble); color:var(--cb-bot-text);">
            ✅ Got it! We'll be in touch shortly.
          </div>`;
      }
      leadCaptured = true;
    } catch {
      addMessage("bot", "Sorry, couldn't save your details. Please try again.");
    }
  }

  function buildBubbleContent() {
  // avatar_url is specifically for the bubble — always takes priority
  if (config.avatar_url) return `<img src="${config.avatar_url}" alt="avatar" />`;
  // bubble_icon takes next priority — emoji check
  if (config.bubble_icon && !iconMap[config.bubble_icon]) return `<span class="cb-emoji">${config.bubble_icon}</span>`;
  // named icon (chat, smile, question, headset)
  if (config.bubble_icon && iconMap[config.bubble_icon]) return iconMap[config.bubble_icon];
  // logo_url is a last resort fallback only if no icon is set
  if (config.logo_url) return `<img src="${config.logo_url}" alt="${config.business_name}" />`;
  // default
  return iconMap.chat;
}

  function buildHeaderAvatar() {
    if (config.logo_url) return `<img src="${config.logo_url}" alt="logo" />`;
    return config.business_name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "💬";
  }

  function buildWidget() {
    const dark = config.theme === "dark";
    const wrapper = document.createElement("div");
    wrapper.id = "cb-widget";
    wrapper.innerHTML = `
      <div id="cb-bubble">
        ${config.show_label ? `<span id="cb-bubble-label">${config.chat_bubble_label}</span>` : ""}
        <button id="cb-bubble-btn" aria-label="Open chat">${buildBubbleContent()}</button>
      </div>
      <div id="cb-window" role="dialog" aria-label="Chat support">
        <div id="cb-header">
          <div id="cb-header-avatar">${buildHeaderAvatar()}</div>
          <div id="cb-header-info">
            <div id="cb-header-name">${config.business_name}</div>
            ${config.show_online_status ? `<div id="cb-header-status"><span class="cb-status-dot"></span> Online</div>` : ""}
          </div>
          <button id="cb-close-btn" aria-label="Close">✕</button>
        </div>
        <div id="cb-messages"></div>
        <div id="cb-input-area">
          <textarea id="cb-input" placeholder="Type your message..." rows="1" aria-label="Message"></textarea>
          <button id="cb-send" aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        ${config.show_branding ? `<div id="cb-footer">Powered by <a href="https://zerochatbot.com" target="_blank" rel="noopener" style="color: ${dark ? "#d6e6ff" : "var(--cb-primary)"}; text-decoration: none; font-weight: 500;">ZeroChatbot</a></div>` : ""}
      </div>
    `;
    document.body.appendChild(wrapper);
  }

  function addMessage(role, text) {
    const el = document.getElementById("cb-messages");
    const msg = document.createElement("div");
    msg.className = `cb-msg cb-msg-${role}`;
    msg.innerHTML = `<div class="cb-bubble-text">${escapeHTML(text)}</div>`;
    el.appendChild(msg);
    el.scrollTop = el.scrollHeight;
  }

  function showTyping() {
    const el = document.getElementById("cb-messages");
    const t = document.createElement("div");
    t.id = "cb-typing-indicator";
    t.className = "cb-msg cb-msg-bot";
    t.innerHTML = `<div class="cb-typing"><span></span><span></span><span></span></div>`;
    el.appendChild(t);
    el.scrollTop = el.scrollHeight;
  }

  function hideTyping() { document.getElementById("cb-typing-indicator")?.remove(); }

  async function sendMessage() {
    if (isLoading) return;
    const input = document.getElementById("cb-input");
    const sendBtn = document.getElementById("cb-send");
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    input.style.height = "auto";
    addMessage("user", message);
    conversationHistory.push({ role: "user", content: message });
    messageCount++;
    // Check if we should show the lead form
    if (config.lead_capture_enabled && !leadCaptured) {
      if (config.lead_capture_trigger === "after_messages" && messageCount >= config.lead_capture_after) {
        setTimeout(showLeadForm, 1000);
      }
    }

    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: BUSINESS_ID, message, history: conversationHistory.slice(-6) }),
      });
      const data = await res.json();
      hideTyping();
      if (data.reply) {
        addMessage("bot", data.reply);
        conversationHistory.push({ role: "assistant", content: data.reply });
      } else {
        addMessage("bot", "Sorry, something went wrong. Please try again.");
      }
    } catch {
      hideTyping();
      addMessage("bot", "Connection error. Please try again.");
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    const win = document.getElementById("cb-window");
    const label = document.getElementById("cb-bubble-label");
    if (isOpen) {
      win.classList.add("cb-open");
      if (label) label.style.opacity = "0";
      document.getElementById("cb-input")?.focus();
    } else {
      win.classList.remove("cb-open");
      if (label) setTimeout(() => { label.style.opacity = "1"; }, 300);
    }
  }

  function bindEvents() {
    document.getElementById("cb-bubble").addEventListener("click", toggleChat);
    document.getElementById("cb-close-btn").addEventListener("click", (e) => { e.stopPropagation(); toggleChat(); });
    document.getElementById("cb-send").addEventListener("click", sendMessage);
    const input = document.getElementById("cb-input");
    input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 100) + "px"; });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config/${BUSINESS_ID}`);
      if (res.ok) { const remote = await res.json(); config = { ...config, ...remote }; }
    } catch { console.warn("[Chatbot] Could not load config."); }
  }

  function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  }

  async function init() {
    await loadConfig();
    injectStyles();
    buildWidget();
    bindEvents();
    setTimeout(() => addMessage("bot", config.welcome_message), 500);

    // Auto open if configured
    if (config.auto_open) {
      setTimeout(() => {
        if (!isOpen) toggleChat();
      }, (config.auto_open_delay || 3) * 1000);
    }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
  else { init(); }
})();