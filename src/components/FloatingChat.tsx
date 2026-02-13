import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, X, ExternalLink, ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useChatSessions, useChatMessages } from "@/hooks/useChatData";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import threadableIcon from "@/assets/threadable-icon.png";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-threadable`;

export function FloatingChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pulsed, setPulsed] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { sessions, createSession, updateTitle } = useChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { messages, sendMessage } = useChatMessages(activeSessionId);

  const isChat = location.pathname === "/chat";
  const hidden = isChat || !user;

  // One-time pulse
  useEffect(() => {
    if (!pulsed) {
      const t = setTimeout(() => setPulsed(true), 2000);
      return () => clearTimeout(t);
    }
  }, [pulsed]);

  // Load most recent session when opening
  useEffect(() => {
    if (open && !activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [open, activeSessionId, sessions]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 80) + "px";
  }, [input]);

  const handleFabClick = () => {
    if (isMobile) {
      navigate("/chat");
    } else {
      setOpen(true);
    }
  };

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || isTyping) return;
    setInput("");

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession();
      sessionId = session.id;
      setActiveSessionId(sessionId);
    }

    await sendMessage({ content: msg, role: "user" });

    if (messages.length === 0) {
      const autoTitle = msg.slice(0, 50) + (msg.length > 50 ? "..." : "");
      await updateTitle({ id: sessionId, title: autoTitle });
    }

    const history = [...messages, { role: "user" as const, content: msg, id: "", session_id: "", user_id: "", created_at: "" }]
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));
    history.pop();

    setIsTyping(true);
    setStreamingContent("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsTyping(false); return; }

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ message: msg, message_history: history }),
      });

      if (!resp.ok || !resp.body) {
        await sendMessage({ content: "⚠️ AI temporarily unavailable.", role: "assistant" });
        setIsTyping(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setStreamingContent(fullResponse);
            }
          } catch { break; }
        }
      }

      if (fullResponse.trim()) {
        await sendMessage({ content: fullResponse, role: "assistant" });
      }
    } catch {
      await sendMessage({ content: "⚠️ Something went wrong.", role: "assistant" });
    }
    setStreamingContent("");
    setIsTyping(false);
  }, [input, activeSessionId, isTyping, messages, createSession, sendMessage, updateTitle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (hidden) return null;

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          onClick={handleFabClick}
          className={cn(
            "fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-lg",
            "hover:scale-105 transition-transform duration-200",
            !pulsed && "animate-pulse"
          )}
          style={{ zIndex: 9999 }}
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          style={{ width: 380, height: 500, zIndex: 9999 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
              <span className="text-sm font-semibold text-foreground">Ask Threadable</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setOpen(false); navigate("/chat"); }}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-3 py-3 space-y-3">
            {messages.length === 0 && !isTyping && (
              <p className="text-xs text-muted-foreground text-center mt-8">Ask anything about your content strategy...</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-xs",
                  m.role === "user"
                    ? "bg-primary/15 text-foreground"
                    : "bg-muted/50 border border-border text-foreground"
                )}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {isTyping && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-muted/50 border border-border rounded-lg px-3 py-2 text-xs">
                  <p className="whitespace-pre-wrap">{streamingContent}</p>
                </div>
              </div>
            )}
            {isTyping && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none px-2 py-1.5"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
