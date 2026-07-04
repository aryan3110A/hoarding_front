"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageCircle,
  X,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
} from "lucide-react";
import {
  chatbotAPI,
  type ChatbotResponse,
  type SuggestionCategory,
} from "@/lib/chatbotApi";
import type { ChatbotIntent, ChatMessage } from "./types";

const INTRO =
  "Ask questions about sales, hoardings, rent, enquiries, proposals, renewals and business performance.";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSessionId() {
  if (typeof window === "undefined") return "server";
  let id = sessionStorage.getItem("chatbotSessionId");
  if (!id) {
    id = uid();
    sessionStorage.setItem("chatbotSessionId", id);
  }
  return id;
}

export default function ChatbotWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState("sales");
  const [promptsExpanded, setPromptsExpanded] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!open) return;
    chatbotAPI
      .getSuggestions()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) setSuggestions(res.data);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const runQuery = useCallback(
    async (payload: {
      message: string;
      intent?: ChatbotIntent;
      filters?: Record<string, unknown>;
    }) => {
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        text: payload.message,
      };
      const pendingId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: "assistant", text: "Thinking...", loading: true },
      ]);
      setLoading(true);
      try {
        const res = await chatbotAPI.query({
          message: payload.message,
          sessionId: getSessionId(),
          intent: payload.intent,
          filters: payload.filters,
        });
        const data = res?.data as ChatbotResponse;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  id: pendingId,
                  role: "assistant",
                  text: data?.summary || "No response.",
                  response: data,
                }
              : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  id: pendingId,
                  role: "assistant",
                  text: "The data could not be fetched right now. Please try again.",
                }
              : m,
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    runQuery({ message: text });
  };

  const onClear = () => {
    setMessages([]);
    setExpandedBlocks({});
    sessionStorage.removeItem("chatbotSessionId");
  };

  const handleAction = async (
    action: ChatbotResponse["actions"][0],
    response?: ChatbotResponse,
  ) => {
    if (action.type === "navigate" && action.href) {
      router.push(action.href);
      if (mobile) setOpen(false);
      return;
    }
    if (action.type === "export" && response) {
      try {
        const blob = await chatbotAPI.exportCsv({
          intent: response.intent,
          filters: response.filters,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "shubham-assistant-export.csv";
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  };

  const activePrompts = useMemo(() => {
    return suggestions.find((s) => s.id === activeCategory)?.prompts || [];
  }, [suggestions, activeCategory]);

  const hasMessages = messages.length > 0;

  const renderAssistant = (msg: ChatMessage) => {
    const r = msg.response;
    if (!r) return <p className="chatbot-msg-text">{msg.text}</p>;

    return (
      <div className="chatbot-assistant-block">
        <p className="chatbot-msg-text">{r.summary}</p>
        {r.resolvedPeriod && (
          <p className="chatbot-meta">Showing data for {r.resolvedPeriod}</p>
        )}
        <p className="chatbot-meta">{r.dataFreshness}</p>
        {r.breakdown?.length > 0 && (
          <ul className="chatbot-breakdown">
            {r.breakdown.map((b, i) => (
              <li key={i}>
                <strong>{b.label}:</strong> {b.value}
              </li>
            ))}
          </ul>
        )}
        {r.expandable?.map((block) => {
          const key = `${msg.id}-${block.id}`;
          const isOpen = expandedBlocks[key];
          return (
            <div key={block.id} className="chatbot-expandable">
              <button
                type="button"
                className="chatbot-expand-toggle"
                onClick={() =>
                  setExpandedBlocks((prev) => ({ ...prev, [key]: !prev[key] }))
                }
              >
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {block.title}
              </button>
              {isOpen && (
                <div className="chatbot-table-wrap">
                  <table className="chatbot-table">
                    <thead>
                      <tr>
                        {Object.keys(block.rows[0] || {}).map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, idx) => (
                        <tr key={idx}>
                          {Object.keys(block.rows[0] || {}).map((h) => (
                            <td key={h}>{String(row[h] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {r.actions?.length > 0 && (
          <div className="chatbot-actions">
            {r.actions.map((action, i) => (
              <button
                key={i}
                type="button"
                className="chatbot-action-btn"
                onClick={() => handleAction(action, r)}
              >
                {action.exportType === "csv" ? <Download size={14} /> : null}
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="chatbot-fab"
          onClick={() => setOpen(true)}
          aria-label="Ask Shubham Assistant"
        >
          <MessageCircle size={20} />
          <span>Ask Shubham Assistant</span>
        </button>
      )}

      {open && (
        <div
          className={`chatbot-panel ${mobile ? "chatbot-panel-mobile" : ""} ${hasMessages ? "chatbot-panel-with-messages" : "chatbot-panel-empty"}`}
        >
          <div className="chatbot-header">
            <div className="chatbot-header-icon">
              <Sparkles size={18} />
            </div>
            <div className="chatbot-header-text">
              <h3>Shubham Assistant</h3>
              <p>{INTRO}</p>
            </div>
            <button
              type="button"
              className="chatbot-icon-btn"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              <X size={18} />
            </button>
          </div>

          {/* Categories + prompts — always visible */}
          <div className="chatbot-quick-section">
            <div className="chatbot-quick-header">
              <span className="chatbot-quick-title">Quick questions</span>
              {hasMessages && (
                <button
                  type="button"
                  className="chatbot-quick-toggle"
                  onClick={() => setPromptsExpanded((v) => !v)}
                >
                  {promptsExpanded ? "Hide" : "Show"}
                  {promptsExpanded ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>
              )}
            </div>

            <div className="chatbot-categories">
              {suggestions.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`chatbot-cat-btn ${activeCategory === cat.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setPromptsExpanded(true);
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {(!hasMessages || promptsExpanded) && (
              <div className="chatbot-prompts">
                {activePrompts.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="chatbot-prompt-btn"
                    disabled={loading}
                    onClick={() =>
                      runQuery({
                        message: p.label,
                        intent: p.intent,
                        filters: p.filters,
                      })
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {hasMessages && (
            <div className="chatbot-messages">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chatbot-msg chatbot-msg-${msg.role}`}
                >
                  {msg.role === "user" ? (
                    <p className="chatbot-msg-text">{msg.text}</p>
                  ) : msg.loading ? (
                    <p className="chatbot-msg-text chatbot-loading">
                      Thinking...
                    </p>
                  ) : (
                    renderAssistant(msg)
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          <div className="chatbot-footer">
            <button
              type="button"
              className="chatbot-icon-btn chatbot-clear-btn"
              onClick={onClear}
              title="Clear conversation"
            >
              <Trash2 size={16} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
              placeholder="Ask in English, Hinglish or Gujlish..."
              disabled={loading}
            />
            <button
              type="button"
              className="chatbot-send-btn"
              onClick={onSend}
              disabled={loading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .chatbot-fab {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 1200;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(
            135deg,
            var(--brand-blue, #1f5ca9) 0%,
            var(--brand-cyan, #00bbf1) 100%
          );
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 8px 24px rgba(31, 92, 169, 0.35);
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .chatbot-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(31, 92, 169, 0.4);
        }

        .chatbot-panel {
          position: fixed;
          top: 72px;
          right: 0;
          width: min(420px, 100vw);
          height: calc(100vh - 72px);
          z-index: 1199;
          display: flex;
          flex-direction: column;
          background: #ffffff;
          color: var(--text-primary, #0f172a);
          border-left: 1px solid var(--border-color, #e2e8f0);
          box-shadow: -4px 0 24px rgba(15, 23, 42, 0.08);
        }
        .chatbot-panel-mobile {
          top: 0;
          left: 0;
          right: 0;
          width: 100vw;
          height: 100vh;
          border-left: none;
        }

        .chatbot-panel-empty {
          display: flex;
          flex-direction: column;
        }
        .chatbot-panel-empty .chatbot-quick-section {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .chatbot-panel-with-messages .chatbot-quick-section {
          flex-shrink: 0;
        }

        .chatbot-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--brand-cyan, #00bbf1) 12%, white) 0%,
            color-mix(in srgb, var(--brand-blue, #1f5ca9) 8%, white) 100%
          );
          flex-shrink: 0;
        }
        .chatbot-header-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(
            135deg,
            var(--brand-blue, #1f5ca9),
            var(--brand-cyan, #00bbf1)
          );
          color: #fff;
          flex-shrink: 0;
        }
        .chatbot-header-text {
          flex: 1;
          min-width: 0;
        }
        .chatbot-header h3 {
          margin: 0;
          color: var(--brand-blue, #1f5ca9);
          font-size: 17px;
          font-weight: 800;
        }
        .chatbot-header p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #64748b !important;
          line-height: 1.45;
        }

        .chatbot-quick-section {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          background: #f8fafc;
        }
        .chatbot-quick-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .chatbot-quick-title {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-secondary, #64748b);
        }
        .chatbot-quick-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          background: none;
          color: var(--brand-blue, #1f5ca9);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 2px 4px;
        }

        .chatbot-categories {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 10px;
        }
        .chatbot-cat-btn {
          border: 1px solid color-mix(in srgb, var(--brand-blue, #1f5ca9) 25%, white);
          background: #ffffff;
          color: var(--brand-blue, #1f5ca9);
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .chatbot-cat-btn:hover {
          background: color-mix(in srgb, var(--brand-cyan, #00bbf1) 12%, white);
        }
        .chatbot-cat-btn.active {
          background: linear-gradient(
            135deg,
            var(--brand-blue, #1f5ca9),
            var(--brand-cyan, #00bbf1)
          );
          border-color: transparent;
          color: #fff;
        }

        .chatbot-prompts {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .chatbot-panel-with-messages .chatbot-prompts {
          max-height: 130px;
          overflow-y: auto;
        }

        .chatbot-prompt-btn {
          text-align: left;
          border: 1px solid var(--border-color, #e2e8f0);
          background: #ffffff;
          color: var(--text-primary, #0f172a);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 13px;
          line-height: 1.35;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease,
            box-shadow 0.15s ease;
        }
        .chatbot-prompt-btn:hover:not(:disabled) {
          border-color: var(--brand-cyan, #00bbf1);
          background: color-mix(in srgb, var(--brand-cyan, #00bbf1) 8%, white);
          box-shadow: 0 2px 8px rgba(0, 187, 241, 0.12);
        }
        .chatbot-prompt-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .chatbot-messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #ffffff;
        }

        .chatbot-msg {
          max-width: 92%;
          padding: 10px 12px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.5;
        }
        .chatbot-msg-user {
          align-self: flex-end;
          background: linear-gradient(
            135deg,
            var(--brand-blue, #1f5ca9),
            color-mix(in srgb, var(--brand-cyan, #00bbf1) 70%, var(--brand-blue, #1f5ca9))
          );
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .chatbot-msg-assistant {
          align-self: flex-start;
          background: #f1f5f9;
          border: 1px solid var(--border-color, #e2e8f0);
          color: #0f172a;
          border-bottom-left-radius: 4px;
        }
        .chatbot-msg-user .chatbot-msg-text,
        .chatbot-msg-user p {
          margin: 0;
          white-space: pre-wrap;
          color: #ffffff !important;
        }
        .chatbot-msg-assistant .chatbot-msg-text,
        .chatbot-msg-assistant p,
        .chatbot-msg-assistant strong,
        .chatbot-msg-assistant li {
          color: #0f172a !important;
        }
        .chatbot-msg-text {
          margin: 0;
          white-space: pre-wrap;
        }
        .chatbot-meta {
          margin: 6px 0 0;
          font-size: 11px;
          color: #64748b !important;
        }
        .chatbot-breakdown {
          margin: 10px 0 0;
          padding-left: 18px;
        }
        .chatbot-breakdown li {
          margin-bottom: 4px;
        }
        .chatbot-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 10px;
        }
        .chatbot-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid color-mix(in srgb, var(--brand-blue, #1f5ca9) 30%, white);
          background: #ffffff;
          color: var(--brand-blue, #1f5ca9);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .chatbot-action-btn:hover {
          background: color-mix(in srgb, var(--brand-cyan, #00bbf1) 10%, white);
        }
        .chatbot-expandable {
          margin-top: 10px;
        }
        .chatbot-expand-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--brand-blue, #1f5ca9) !important;
          cursor: pointer;
          padding: 0;
          font-size: 12px;
          font-weight: 600;
        }
        .chatbot-table-wrap {
          margin-top: 8px;
          overflow: auto;
          max-height: 160px;
          border-radius: 8px;
          border: 1px solid var(--border-color, #e2e8f0);
        }
        .chatbot-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          background: #fff;
        }
        .chatbot-table th {
          background: #f8fafc;
          color: #64748b !important;
          font-weight: 700;
        }
        .chatbot-table th,
        .chatbot-table td {
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          padding: 6px 8px;
          text-align: left;
          color: #0f172a !important;
        }

        .chatbot-footer {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 8px;
          align-items: center;
          padding: 12px 16px;
          border-top: 1px solid var(--border-color, #e2e8f0);
          background: #ffffff;
          flex-shrink: 0;
        }
        .chatbot-footer input {
          width: 100%;
          border-radius: 10px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: #f8fafc;
          color: var(--text-primary, #0f172a);
          padding: 10px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .chatbot-footer input:focus {
          border-color: var(--brand-cyan, #00bbf1);
          box-shadow: 0 0 0 3px rgba(0, 187, 241, 0.15);
          background: #fff;
        }
        .chatbot-icon-btn {
          border: 1px solid var(--border-color, #e2e8f0);
          background: #f8fafc;
          color: var(--text-secondary, #64748b);
          border-radius: 10px;
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .chatbot-icon-btn:hover {
          background: #f1f5f9;
          color: var(--brand-blue, #1f5ca9);
        }
        .chatbot-clear-btn:hover {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }
        .chatbot-send-btn {
          border: none;
          background: linear-gradient(
            135deg,
            var(--brand-blue, #1f5ca9),
            var(--brand-cyan, #00bbf1)
          );
          color: #fff;
          border-radius: 10px;
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .chatbot-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .chatbot-loading {
          opacity: 0.85;
          font-style: italic;
          color: #64748b !important;
        }
      `}</style>
    </>
  );
}
