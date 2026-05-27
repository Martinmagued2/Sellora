"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Bot, Loader2, MessageSquare, TrendingUp, Package, ChevronRight } from "lucide-react";
import { useChat } from "@ai-sdk/react";

// Helper: extract text content from a UIMessage's parts array
function getMessageText(msg) {
  if (!msg.parts || !Array.isArray(msg.parts)) return "";
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

// Helper: check if message has tool invocations
function hasToolInvocations(msg) {
  if (!msg.parts || !Array.isArray(msg.parts)) return false;
  return msg.parts.some((p) => p.type === "tool-invocation");
}

export default function CopilotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const { messages, sendMessage, status, error, clearError } = useChat({
    api: "/api/chat",
    onError: (err) => {
      console.error("Copilot Error:", err);
    }
  });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    clearError?.();
    sendMessage(input);
    setInput("");
  };

  const handleSuggestionClick = (text) => {
    if (isLoading) return;
    clearError?.();
    sendMessage(text);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, status]);

  const suggestions = [
    { icon: TrendingUp, text: "How are my sales this week?", color: "#6c5ce7" },
    { icon: Package, text: "What are my top products?", color: "#00b894" },
    { icon: MessageSquare, text: "Draft a product description", color: "#e17055" },
  ];

  return (
    <>
      <button
        className={`copilot-fab ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Ask Copilot"
        id="copilot-toggle"
      >
        <div className="copilot-fab-inner">
          <Sparkles size={22} />
        </div>
        <div className="copilot-fab-pulse" />
      </button>

      {isOpen && (
        <div className="copilot-panel">
          {/* Header */}
          <div className="copilot-header">
            <div className="copilot-header-info">
              <div className="copilot-avatar">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="copilot-title">Sellora Copilot</span>
                <span className="copilot-subtitle">
                  {isLoading ? "Thinking..." : "AI Assistant"}
                </span>
              </div>
            </div>
            <button className="copilot-close" onClick={() => setIsOpen(false)} id="copilot-close">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="copilot-messages">
            {messages.length === 0 ? (
              <div className="copilot-empty">
                <div className="copilot-empty-glow" />
                <div className="copilot-empty-icon">
                  <Sparkles size={28} />
                </div>
                <h3>How can I help you today?</h3>
                <p>I can analyze your sales, draft product descriptions, or provide business insights.</p>
                <div className="copilot-suggestions">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s.text)}
                      className="copilot-suggestion-btn"
                      id={`copilot-suggestion-${i}`}
                    >
                      <div className="copilot-suggestion-icon" style={{ "--suggestion-color": s.color }}>
                        <s.icon size={14} />
                      </div>
                      <span>{s.text}</span>
                      <ChevronRight size={14} className="copilot-suggestion-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const text = getMessageText(msg) || msg.content;
                const hasTool = hasToolInvocations(msg);

                return (
                  <div key={msg.id} className={`copilot-msg ${msg.role}`}>
                    {msg.role === "assistant" && (
                      <div className="copilot-msg-avatar">
                        <Bot size={13} />
                      </div>
                    )}
                    <div className="copilot-msg-bubble">
                      {text || (hasTool ? <span className="copilot-tool-call">Analyzing your data...</span> : null)}
                    </div>
                  </div>
                );
              })
            )}
            {isLoading && messages.length > 0 && (
              <div className="copilot-msg assistant">
                <div className="copilot-msg-avatar">
                  <Bot size={13} />
                </div>
                <div className="copilot-msg-bubble copilot-typing">
                  <span className="copilot-typing-dot" />
                  <span className="copilot-typing-dot" />
                  <span className="copilot-typing-dot" />
                </div>
              </div>
            )}
            {error && (
              <div className="copilot-error">
                <span>⚠</span> {error.message || "An error occurred. Please try again."}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form className="copilot-input-area" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              id="copilot-input"
            />
            <button type="submit" disabled={!input || !input.trim() || isLoading} id="copilot-send">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
