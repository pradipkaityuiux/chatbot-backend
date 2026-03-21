/**
 * AI Chatbot Widget
 * 
 * HOW TO EMBED ON ANY CLIENT WEBSITE:
 * ------------------------------------
 * Add this single line before </body>:
 * 
 * <script 
 *   src="https://your-backend.com/widget/chatbot.js"
 *   data-business-id="acme-plumbing"
 * ></script>
 * 
 * That's it. The widget self-initializes.
 */

(function () {
  "use strict";

  // ── Read config from the script tag ──────────────────────────
  const scriptTag = document.currentScript;
  const BUSINESS_ID = scriptTag?.getAttribute("data-business-id");
  const API_BASE = scriptTag?.src
    ? new URL(scriptTag.src).origin
    : "http://localhost:3001";

  if (!BUSINESS_ID) {
    console.warn("[Chatbot] No data-business-id found on script tag.");
    return;
  }

  // ── State ─────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let conversationHistory = [];
  let config = {
    business_name: "Support",
    primary_color: "#2563eb",
    secondary_color: "#f1f5f9",
    welcome_message: "Hi! How can I help you today?",
    chat_bubble_label: "Chat with us",
    logo_url: null,
  };

  // ── Inject styles ─────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #cb-widget * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      #cb-bubble {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99998;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        animation: cb-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      #cb-bubble-btn {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: var(--cb-primary);
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        transition: transform 0.2s, box-shadow 0.2s;
        flex-shrink: 0;
      }

      #cb-bubble-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 25px rgba(0,0,0,0.25);
      }

      #cb-bubble-label {
        background: white;
        color: #1e293b;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 12px rgba(0,0,0,0.12);
        white-space: nowrap;
        opacity: 1;
        transition: opacity 0.2s;
      }

      #cb-window {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 360px;
        height: 520px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.18);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 99999;
        transform: scale(0.8) translateY(20px);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
      }

      #cb-window.cb-open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      #cb-header {
        background: var(--cb-primary);
        color: white;
        padding: 16px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }

      #cb-header-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
        overflow: hidden;
      }

      #cb-header-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      #cb-header-info {
        flex: 1;
      }

      #cb-header-name {
        font-weight: 600;
        font-size: 15px;
      }

      #cb-header-status {
        font-size: 12px;
        opacity: 0.85;
        display: flex;
        align-items: center;
        gap: 5px;
      }

      #cb-header-status::before {
        content: '';
        width: 7px;
        height: 7px;
        background: #4ade80;
        border-radius: 50%;
        display: inline-block;
      }

      #cb-close-btn {
        background: rgba(255,255,255,0.15);
        border: none;
        color: white;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        flex-shrink: 0;
      }

      #cb-close-btn:hover {
        background: rgba(255,255,255,0.25);
      }

      #cb-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
      }

      #cb-messages::-webkit-scrollbar {
        width: 4px;
      }

      #cb-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      #cb-messages::-webkit-scrollbar-thumb {
        background: #e2e8f0;
        border-radius: 4px;
      }

      .cb-msg {
        display: flex;
        flex-direction: column;
        max-width: 82%;
        animation: cb-msg-in 0.2s ease;
      }

      .cb-msg-bot {
        align-self: flex-start;
      }

      .cb-msg-user {
        align-self: flex-end;
      }

      .cb-bubble-text {
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
      }

      .cb-msg-bot .cb-bubble-text {
        background: #f1f5f9;
        color: #1e293b;
        border-bottom-left-radius: 4px;
      }

      .cb-msg-user .cb-bubble-text {
        background: var(--cb-primary);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .cb-typing {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 12px 14px;
        background: #f1f5f9;
        border-radius: 14px;
        border-bottom-left-radius: 4px;
        width: fit-content;
      }

      .cb-typing span {
        width: 7px;
        height: 7px;
        background: #94a3b8;
        border-radius: 50%;
        animation: cb-bounce 1.2s infinite;
      }

      .cb-typing span:nth-child(2) { animation-delay: 0.2s; }
      .cb-typing span:nth-child(3) { animation-delay: 0.4s; }

      #cb-input-area {
        padding: 12px;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 8px;
        align-items: flex-end;
        flex-shrink: 0;
        background: white;
      }

      #cb-input {
        flex: 1;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
        resize: none;
        outline: none;
        max-height: 100px;
        min-height: 40px;
        line-height: 1.4;
        color: #1e293b;
        transition: border-color 0.2s;
        font-family: inherit;
      }

      #cb-input:focus {
        border-color: var(--cb-primary);
      }

      #cb-input::placeholder {
        color: #94a3b8;
      }

      #cb-send {
        background: var(--cb-primary);
        color: white;
        border: none;
        width: 38px;
        height: 38px;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s, transform 0.1s;
        flex-shrink: 0;
      }

      #cb-send:hover {
        opacity: 0.9;
        transform: scale(1.05);
      }

      #cb-send:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        transform: none;
      }

      #cb-footer {
        text-align: center;
        padding: 6px 0 10px;
        font-size: 11px;
        color: #94a3b8;
        flex-shrink: 0;
      }

      @keyframes cb-pop-in {
        from { transform: scale(0.5); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      @keyframes cb-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes cb-bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }

      @media (max-width: 420px) {
        #cb-window {
          width: calc(100vw - 24px);
          right: 12px;
          bottom: 80px;
          height: 480px;
        }

        #cb-bubble {
          right: 16px;
          bottom: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build the widget HTML ─────────────────────────────────────
  function buildWidget() {
    const wrapper = document.createElement("div");
    wrapper.id = "cb-widget";
    wrapper.style.setProperty("--cb-primary", config.primary_color);

    wrapper.innerHTML = `
      <!-- Floating bubble button -->
      <div id="cb-bubble">
        <span id="cb-bubble-label">${config.chat_bubble_label}</span>
        <button id="cb-bubble-btn" aria-label="Open chat">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>

      <!-- Chat window -->
      <div id="cb-window" role="dialog" aria-label="Chat support">
        <div id="cb-header">
          <div id="cb-header-avatar">
            ${config.logo_url
              ? `<img src="${config.logo_url}" alt="${config.business_name} logo" />`
              : "💬"}
          </div>
          <div id="cb-header-info">
            <div id="cb-header-name">${config.business_name}</div>
            <div id="cb-header-status">Online — typically replies instantly</div>
          </div>
          <button id="cb-close-btn" aria-label="Close chat">✕</button>
        </div>

        <div id="cb-messages"></div>

        <div id="cb-input-area">
          <textarea
            id="cb-input"
            placeholder="Type your message..."
            rows="1"
            aria-label="Chat message"
          ></textarea>
          <button id="cb-send" aria-label="Send message">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div id="cb-footer">Powered by AI · Responses may not be 100% accurate</div>
      </div>
    `;

    document.body.appendChild(wrapper);
  }

  // ── Render a message bubble ───────────────────────────────────
  function addMessage(role, text) {
    const messagesEl = document.getElementById("cb-messages");
    const msgEl = document.createElement("div");
    msgEl.className = `cb-msg cb-msg-${role}`;
    msgEl.innerHTML = `<div class="cb-bubble-text">${escapeHTML(text)}</div>`;
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msgEl;
  }

  // ── Show/hide typing indicator ────────────────────────────────
  function showTyping() {
    const messagesEl = document.getElementById("cb-messages");
    const typing = document.createElement("div");
    typing.id = "cb-typing";
    typing.className = "cb-msg cb-msg-bot";
    typing.innerHTML = `<div class="cb-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById("cb-typing");
    if (typing) typing.remove();
  }

  // ── Send a message ────────────────────────────────────────────
  async function sendMessage() {
    if (isLoading) return;

    const input = document.getElementById("cb-input");
    const sendBtn = document.getElementById("cb-send");
    const message = input.value.trim();

    if (!message) return;

    // Clear input
    input.value = "";
    input.style.height = "auto";

    // Show user message
    addMessage("user", message);

    // Track in history
    conversationHistory.push({ role: "user", content: message });

    // Show typing + disable input
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: BUSINESS_ID,
          message,
          history: conversationHistory.slice(-6), // Send last 6 for context
        }),
      });

      const data = await res.json();
      hideTyping();

      if (data.reply) {
        addMessage("bot", data.reply);
        conversationHistory.push({ role: "assistant", content: data.reply });
      } else {
        addMessage("bot", "Sorry, I couldn't process that. Please try again.");
      }

    } catch (err) {
      hideTyping();
      addMessage("bot", "Connection error. Please check your internet and try again.");
      console.error("[Chatbot] Error:", err);
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  // ── Toggle open/close ─────────────────────────────────────────
  function toggleChat() {
    isOpen = !isOpen;
    const window_ = document.getElementById("cb-window");
    const label = document.getElementById("cb-bubble-label");

    if (isOpen) {
      window_.classList.add("cb-open");
      label.style.opacity = "0";
      document.getElementById("cb-input")?.focus();
    } else {
      window_.classList.remove("cb-open");
      setTimeout(() => { label.style.opacity = "1"; }, 300);
    }
  }

  // ── Bind all events ───────────────────────────────────────────
  function bindEvents() {
    document.getElementById("cb-bubble").addEventListener("click", toggleChat);
    document.getElementById("cb-close-btn").addEventListener("click", toggleChat);
    document.getElementById("cb-send").addEventListener("click", sendMessage);

    const input = document.getElementById("cb-input");

    // Auto-resize textarea
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 100) + "px";
    });

    // Send on Enter, new line on Shift+Enter
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // ── Load config from backend ──────────────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config/${BUSINESS_ID}`);
      if (res.ok) {
        const remote = await res.json();
        config = { ...config, ...remote };
      }
    } catch (err) {
      console.warn("[Chatbot] Could not load config, using defaults.");
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\n/g, "<br>");
  }

  // ── Boot sequence ─────────────────────────────────────────────
  async function init() {
    await loadConfig(); // Fetch branding first
    injectStyles();
    buildWidget();
    bindEvents();

    // Show the welcome message after a short delay
    setTimeout(() => {
      addMessage("bot", config.welcome_message);
    }, 500);
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
