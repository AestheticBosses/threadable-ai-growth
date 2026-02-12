import { useState, useRef, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Plus, ArrowUp, Lightbulb, TrendingUp, FileText, ChevronRight, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatSessions, useChatMessages, type ChatSession } from "@/hooks/useChatData";
import { useAuth } from "@/contexts/AuthContext";
import threadableIcon from "@/assets/threadable-icon.png";

const QUICK_ACTIONS = [
  { icon: "💡", label: "Give post ideas", message: "Give me 5 post ideas based on my content archetypes and identity" },
  { icon: "📈", label: "What's trending", message: "What topics are trending right now that I could create Threads content about?" },
  { icon: "📋", label: "Give a template", message: "Give me a post template based on my top-performing content archetypes" },
];

const PLACEHOLDER_RESPONSE = "I'm Threadable AI — this feature is coming soon! I'll be able to help you brainstorm post ideas, find trending topics, and create content using your identity, archetypes, and voice profile.";

function groupSessionsByDate(sessions: ChatSession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.created_at);
    if (d >= today) groups[0].sessions.push(s);
    else if (d >= yesterday) groups[1].sessions.push(s);
    else if (d >= weekAgo) groups[2].sessions.push(s);
    else groups[3].sessions.push(s);
  }

  return groups.filter((g) => g.sessions.length > 0);
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/50"
          style={{
            animation: "bounce 1.4s infinite ease-in-out",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
      <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

const Chat = () => {
  usePageTitle("Chat", "Ask Threadable AI");
  const { user } = useAuth();
  const { sessions, isLoading: sessionsLoading, createSession, updateTitle, deleteSession } = useChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { messages, isLoading: messagesLoading, sendMessage } = useChatMessages(activeSessionId);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-load or create session on mount
  useEffect(() => {
    if (sessionsLoading || activeSessionId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentSession = sessions.find((s) => {
      const d = new Date(s.created_at);
      return d >= today && s.title === "New chat";
    });
    if (recentSession) {
      setActiveSessionId(recentSession.id);
    }
  }, [sessions, sessionsLoading, activeSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;
    setInput("");

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession();
      sessionId = session.id;
      setActiveSessionId(sessionId);
    }

    // Save user message
    await sendMessage({ content: msg, role: "user" });

    // Auto-title from first message
    const currentMessages = messages;
    if (currentMessages.length === 0) {
      const autoTitle = msg.slice(0, 50) + (msg.length > 50 ? "..." : "");
      await updateTitle({ id: sessionId, title: autoTitle });
    }

    // Simulate AI response
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 1500));
    await sendMessage({ content: PLACEHOLDER_RESPONSE, role: "assistant" });
    setIsTyping(false);
  }, [input, activeSessionId, isTyping, messages, createSession, sendMessage, updateTitle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = async () => {
    const session = await createSession();
    setActiveSessionId(session.id);
    setHistoryOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setHistoryOpen(false);
  };

  const isEmpty = messages.length === 0 && !isTyping;
  const grouped = groupSessionsByDate(sessions);

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* History sidebar */}
        <div className={cn(
          "border-r border-border bg-card/50 flex-col overflow-hidden transition-all duration-200",
          historyOpen ? "w-64 flex" : "w-0 hidden md:flex md:w-56"
        )}>
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">History</span>
            <Button size="sm" variant="outline" onClick={handleNewChat} className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" />New chat
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-3">
            {sessionsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto mt-4" />
            ) : sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-4">No chats yet</p>
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 mb-1">{group.label}</p>
                  {group.sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={cn(
                        "w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors truncate flex items-center justify-between group",
                        s.id === activeSessionId
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span className="truncate">{s.title}</span>
                      <Trash2
                        className="h-3 w-3 opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0 ml-1"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await deleteSession(s.id);
                          if (activeSessionId === s.id) setActiveSessionId(null);
                        }}
                      />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main chat */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile history toggle */}
          <div className="md:hidden flex items-center gap-2 p-3 border-b border-border">
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(!historyOpen)} className="gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />History
            </Button>
            <Button size="sm" variant="outline" onClick={handleNewChat} className="gap-1 text-xs ml-auto">
              <Plus className="h-3 w-3" />New
            </Button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-auto">
            <div className="max-w-[700px] mx-auto px-4 py-6">
              {isEmpty ? (
                <div className="flex flex-col items-center justify-center pt-20">
                  <img src={threadableIcon} alt="Threadable" className="h-14 w-14 rounded-xl mb-6" />
                  <h2 className="text-2xl font-bold text-foreground mb-2">What are we creating today?</h2>
                  <p className="text-sm text-muted-foreground mb-8">Ask Threadable to brainstorm, draft, or refine your content.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3",
                        m.role === "user"
                          ? "bg-primary/15 text-foreground"
                          : "bg-card border border-border text-foreground"
                      )}>
                        {m.role === "assistant" && (
                          <div className="flex items-center gap-2 mb-2">
                            <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
                            <span className="text-xs font-medium text-muted-foreground">Threadable</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-card border border-border rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2 mb-1">
                          <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
                          <span className="text-xs font-medium text-muted-foreground">Threadable</span>
                        </div>
                        <TypingIndicator />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-border bg-background">
            <div className="max-w-[700px] mx-auto px-4 py-3">
              <div className="relative rounded-xl border border-border bg-card overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Threadable..."
                  rows={1}
                  className="w-full resize-none bg-transparent px-4 pt-3 pb-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  style={{ maxHeight: 120 }}
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" disabled>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isTyping}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Quick actions */}
              {isEmpty && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleSend(action.message)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                    >
                      <span>{action.icon}</span>
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Chat;
