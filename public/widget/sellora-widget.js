/**
 * Sellora Website Assistant Widget
 *
 * Embeddable script that adds an AI chat widget to any website.
 *
 * Usage (on any website):
 *   <script src="https://www.sellorachat.com/widget/sellora-widget.js"
 *           data-account-id="YOUR_ACCOUNT_ID"
 *           data-position="bottom-right"
 *           async></script>
 *
 * The widget:
 *   - Shows a floating chat bubble
 *   - Opens a chat panel when clicked
 *   - Connects to /api/ai/website-assistant
 *   - Persists visitor_id in localStorage
 *   - Supports quick replies, product cards, order tracking
 */

(function () {
  const script = document.currentScript;
  const accountId = script.getAttribute("data-account-id");
  const position = script.getAttribute("data-position") || "bottom-right";
  const primaryColor = script.getAttribute("data-color") || "#6c5ce7";
  const title = script.getAttribute("data-title") || "Chat with us";

  if (!accountId) {
    console.error("[Sellora Widget] data-account-id is required");
    return;
  }

  // Generate or retrieve visitor_id
  let visitorId = localStorage.getItem("sellora_visitor_id");
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem("sellora_visitor_id", visitorId);
  }

  let sessionId = sessionStorage.getItem("sellora_session_id") || null;

  const API_BASE = "https://www.sellorachat.com";

  // ─── Inject styles ───
  const style = document.createElement("style");
  style.textContent = `
    .sellora-widget-bubble {
      position: fixed;
      ${position.includes("right") ? "right: 20px;" : "left: 20px;"}
      bottom: 20px;
      width: 60px; height: 60px;
      background: linear-gradient(135deg, ${primaryColor} 0%, ${lightenColor(primaryColor, 20)} 100%);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 4px 20px ${primaryColor}55;
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      transition: transform 0.2s ease;
    }
    .sellora-widget-bubble:hover { transform: scale(1.08); }
    .sellora-widget-bubble svg { width: 28px; height: 28px; fill: #fff; }

    .sellora-widget-panel {
      position: fixed;
      ${position.includes("right") ? "right: 20px;" : "left: 20px;"}
      bottom: 90px;
      width: 360px; max-width: calc(100vw - 40px);
      height: 520px; max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .sellora-widget-panel.open { display: flex; }

    .sellora-widget-header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${lightenColor(primaryColor, 20)} 100%);
      color: #fff;
      padding: 14px 18px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .sellora-widget-header-title { font-size: 15px; font-weight: 600; }
    .sellora-widget-header-subtitle { font-size: 11px; opacity: 0.85; }
    .sellora-widget-close {
      background: rgba(255,255,255,0.2); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      font-size: 16px; line-height: 1;
    }

    .sellora-widget-messages {
      flex: 1; overflow-y: auto; padding: 14px;
      background: #f9fafb; display: flex; flex-direction: column; gap: 10px;
    }
    .sellora-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.4; }
    .sellora-msg-visitor { align-self: flex-end; background: ${primaryColor}; color: #fff; }
    .sellora-msg-assistant { align-self: flex-start; background: #fff; color: #111; border: 1px solid #e5e7eb; }
    .sellora-msg-typing { align-self: flex-start; background: #fff; color: #999; font-style: italic; }

    .sellora-widget-quick-replies {
      display: flex; gap: 6px; padding: 8px 14px; flex-wrap: wrap;
      background: #f9fafb; border-top: 1px solid #e5e7eb;
    }
    .sellora-quick-reply {
      background: #fff; border: 1px solid ${primaryColor}; color: ${primaryColor};
      padding: 6px 12px; border-radius: 16px; font-size: 12px; cursor: pointer;
      transition: all 0.15s;
    }
    .sellora-quick-reply:hover { background: ${primaryColor}; color: #fff; }

    .sellora-widget-input {
      padding: 10px 14px; background: #fff; border-top: 1px solid #e5e7eb;
      display: flex; gap: 8px;
    }
    .sellora-widget-input input {
      flex: 1; border: 1px solid #e5e7eb; border-radius: 20px;
      padding: 10px 16px; font-size: 14px; outline: none;
    }
    .sellora-widget-input input:focus { border-color: ${primaryColor}; }
    .sellora-widget-send {
      background: ${primaryColor}; color: #fff; border: none;
      width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .sellora-widget-send svg { width: 18px; height: 18px; fill: #fff; }
  `;
  document.head.appendChild(style);

  // ─── Create bubble + panel ───
  const bubble = document.createElement("div");
  bubble.className = "sellora-widget-bubble";
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`;
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.className = "sellora-widget-panel";
  panel.innerHTML = `
    <div class="sellora-widget-header">
      <div>
        <div class="sellora-widget-header-title">${title}</div>
        <div class="sellora-widget-header-subtitle">Powered by Sellora AI</div>
      </div>
      <button class="sellora-widget-close">×</button>
    </div>
    <div class="sellora-widget-messages" id="sellora-messages"></div>
    <div class="sellora-widget-quick-replies" id="sellora-quick-replies"></div>
    <div class="sellora-widget-input">
      <input type="text" id="sellora-input" placeholder="Type a message..." />
      <button class="sellora-widget-send" id="sellora-send">
        <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
      </button>
    </div>
  `;
  document.body.appendChild(panel);

  // ─── Toggle panel ───
  bubble.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      document.getElementById("sellora-input").focus();
      // Send greeting if first time
      if (!sessionId) {
        sendMessage("Hi! I'm looking for help.", true);
      }
    }
  });

  panel.querySelector(".sellora-widget-close").addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // ─── Send message ───
  const input = document.getElementById("sellora-input");
  const sendBtn = document.getElementById("sellora-send");
  const messagesEl = document.getElementById("sellora-messages");
  const quickRepliesEl = document.getElementById("sellora-quick-replies");

  function sendMessage(text, isGreeting = false) {
    if (!text.trim()) return;

    // Add visitor message
    addMessage(text, "visitor");
    input.value = "";
    quickRepliesEl.innerHTML = "";

    // Show typing indicator
    const typingEl = addMessage("Typing...", "typing");

    // Call API
    fetch(`${API_BASE}/api/ai/website-assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: accountId,
        message: text,
        visitor_id: visitorId,
        session_id: sessionId,
      }),
    })
      .then(r => r.json())
      .then(data => {
        typingEl.remove();
        if (data.error) {
          addMessage("Sorry, I couldn't process that. Please try again.", "assistant");
          return;
        }
        if (data.conversation_id) {
          sessionId = data.conversation_id;
          sessionStorage.setItem("sellora_session_id", sessionId);
        }
        addMessage(data.reply, "assistant");

        // Render quick replies
        if (data.quick_replies && data.quick_replies.length > 0) {
          data.quick_replies.forEach(qr => {
            const btn = document.createElement("button");
            btn.className = "sellora-quick-reply";
            btn.textContent = qr;
            btn.addEventListener("click", () => sendMessage(qr));
            quickRepliesEl.appendChild(btn);
          });
        }
      })
      .catch(err => {
        typingEl.remove();
        addMessage("Connection error. Please try again.", "assistant");
        console.error("[Sellora Widget] error:", err);
      });
  }

  function addMessage(text, type) {
    const msg = document.createElement("div");
    msg.className = `sellora-msg sellora-msg-${type}`;
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msg;
  }

  sendBtn.addEventListener("click", () => sendMessage(input.value));
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage(input.value);
  });

  // ─── Helpers ───
  function lightenColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }
})();
