import { useState, useRef, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ArrowUp, Trash2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatSessions, useChatMessages, type ChatSession } from "@/hooks/useChatData";
import { useChatContextData } from "@/hooks/useChatContextData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import threadableIcon from "@/assets/threadable-icon.png";
import { InlineContextCards } from "@/components/chat/ContextSelection";
import { parsePostIdeas } from "@/components/chat/PostIdeasView";
import { DraftingProgress } from "@/components/chat/DraftingProgress";
import { PostPreviewSplit } from "@/components/chat/PostPreviewSplit";
import { useQuery } from "@tanstack/react-query";

/* ─── Flow item types ─── */
type FlowItem =
  | { id: string; type: "user"; content: string }
  | { id: string; type: "ai"; content: string }
  | { id: string; type: "typing" }
  | { id: string; type: "context-cards"; disabled: boolean; selectedLabel?: string }
  | { id: string; type: "idea-cards"; ideas: { title: string; body: string }[] }
  | { id: string; type: "drafting" }
  | { id: string; type: "streaming"; content: string };

const QUICK_ACTIONS = [
  { icon: "💡", label: "Give post ideas", action: "ideas" as const },
  { icon: "📈", label: "What's trending", action: "trending" as const, message: "What topics are trending right now that align with my brand positioning and target audience? Give me 3-5 trending angles I could create Threads content about. Format each as a numbered idea with a bold title and 2-3 sentence description." },
  { icon: "📋", label: "Give a template", action: "template" as const, message: "Give me 5 fill-in-the-blank post templates based on my top-performing archetypes. For each template, give a bold title and the template text with [blanks]. Format as numbered ideas." },
];

const MORE_ACTIONS = [
  { icon: "♻️", label: "Repurpose a post", message: "Take my top performing post and give me 3 ways to repurpose it using different archetypes. Format as numbered ideas with a bold title and description." },
  { icon: "🔝", label: "Write a TOF post", message: "Write a top-of-funnel reach post using my Authority Insider Drop archetype. Use a real story from my Identity." },
  { icon: "🎯", label: "Write a BOF post", message: "Write a bottom-of-funnel conversion post that drives toward my main goal. Make it feel natural, not salesy." },
  { icon: "✏️", label: "Improve a draft", message: "I have a draft post I want to improve. I'll paste it and you score it against my content preferences and suggest improvements." },
  { icon: "📅", label: "Plan tomorrow's content", message: "Based on my content plan and funnel strategy, what should I post tomorrow? Give me 2-3 options with hooks." },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-threadable`;

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
          style={{ animation: "bounce 1.4s infinite ease-in-out", animationDelay: `${i * 0.16}s` }}
        />
      ))}
      <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

async function streamAIResponse({
  message, messageHistory, onDelta, onDone, onError,
}: {
  message: string;
  messageHistory: { role: string; content: string }[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { onError("Not logged in"); return; }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ message, message_history: messageHistory }),
  });

  if (!resp.ok) {
    let errMsg = "AI temporarily unavailable. Please try again.";
    try { const errData = await resp.json(); if (errData.error) errMsg = errData.error; } catch {}
    onError(errMsg); return;
  }
  if (!resp.body) { onError("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });
    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }
  // flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw || !raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const c = parsed.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {}
    }
  }
  onDone();
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let idCounter = 0;
const uid = () => `flow-${++idCounter}-${Date.now()}`;

/* ─── Main component ─── */
const Chat = () => {
  usePageTitle("Chat", "Ask Threadable AI");
  const { user } = useAuth();
  const { sessions, isLoading: sessionsLoading, createSession, updateTitle, deleteSession } = useChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { messages, isLoading: messagesLoading, sendMessage, refetch } = useChatMessages(activeSessionId);
  const contextData = useChatContextData();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Flow state
  const [flowItems, setFlowItems] = useState<FlowItem[]>([]);
  const [flowMode, setFlowMode] = useState<"empty" | "guided" | "chat" | "preview">("empty");
  const [postIdeas, setPostIdeas] = useState<{ title: string; body: string }[]>([]);
  const [draftedPost, setDraftedPost] = useState("");
  const [postAnalysis, setPostAnalysis] = useState("");
  const [draftingIdea, setDraftingIdea] = useState<{ title: string; body: string } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Profile for Threads preview
  const profileQuery = useQuery({
    queryKey: ["user-profile-chat", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, threads_username, threads_profile_picture_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });
  const profile = profileQuery.data;

  // Auto-select recent session
  useEffect(() => {
    if (sessionsLoading || activeSessionId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recentSession = sessions.find((s) => new Date(s.created_at) >= today && s.title === "New chat");
    if (recentSession) setActiveSessionId(recentSession.id);
  }, [sessions, sessionsLoading, activeSessionId]);

  // Scroll to bottom on flow changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [flowItems, messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // On session change, detect mode
  useEffect(() => {
    if (messages.length > 0) {
      setFlowMode("chat");
    } else {
      setFlowMode("empty");
    }
    setFlowItems([]);
    setPostIdeas([]);
    setDraftedPost("");
    setPostAnalysis("");
    setDraftingIdea(null);
  }, [activeSessionId]);

  /* ─── Helpers ─── */
  const addItem = useCallback((item: any) => {
    const newItem = { ...item, id: uid() } as FlowItem;
    setFlowItems((prev) => [...prev, newItem]);
    return newItem.id;
  }, []);

  const removeItem = useCallback((id: string) => {
    setFlowItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<FlowItem>) => {
    setFlowItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } as FlowItem : i)));
  }, []);

  const ensureSession = async (): Promise<string> => {
    if (activeSessionId) return activeSessionId;
    const session = await createSession();
    setActiveSessionId(session.id);
    return session.id;
  };

  const getMessageHistory = () => [...messages].slice(-20).map((m) => ({ role: m.role, content: m.content }));

  /* ─── Core AI streaming with flow items ─── */
  const streamToFlow = useCallback(async (
    msg: string,
    opts?: { saveToDb?: boolean; onComplete?: (text: string) => void }
  ) => {
    const sessionId = await ensureSession();

    if (opts?.saveToDb !== false) {
      await sendMessage({ content: msg, role: "user" });
      if (messages.length === 0) {
        const autoTitle = msg.slice(0, 50) + (msg.length > 50 ? "..." : "");
        await updateTitle({ id: sessionId, title: autoTitle });
      }
    }

    const streamingId = addItem({ type: "streaming", content: "" });
    let fullResponse = "";

    await streamAIResponse({
      message: msg,
      messageHistory: getMessageHistory(),
      onDelta: (chunk) => {
        fullResponse += chunk;
        updateItem(streamingId, { content: fullResponse });
      },
      onDone: async () => {
        removeItem(streamingId);
        if (fullResponse.trim()) {
          await sendMessage({ content: fullResponse, role: "assistant" });
          addItem({ type: "ai", content: fullResponse });
        }
        opts?.onComplete?.(fullResponse);
      },
      onError: async (errMsg) => {
        removeItem(streamingId);
        addItem({ type: "ai", content: `⚠️ ${errMsg}` });
        toast({ title: "Error", description: errMsg, variant: "destructive" });
      },
    });
  }, [activeSessionId, messages, sendMessage, updateTitle, ensureSession, addItem, removeItem, updateItem]);

  /* ─── Flow: "Give post ideas" ─── */
  const handlePostIdeasAction = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setFlowMode("guided");
    setFlowItems([]);

    addItem({ type: "user", content: "Give me post ideas" });
    const typingId = addItem({ type: "typing" });

    await ensureSession();
    await sendMessage({ content: "Give me post ideas", role: "user" });

    await delay(1500);
    removeItem(typingId);
    addItem({ type: "ai", content: "💡 What do you want your post ideas to be about?\nPick one to get started:" });
    addItem({ type: "context-cards", disabled: false });

    setIsBusy(false);
  }, [isBusy, addItem, removeItem, ensureSession, sendMessage]);

  /* ─── Flow: Context item selected (single select) ─── */
  const handleContextSelect = useCallback(async (item: { type: string; label: string; content: string }) => {
    if (isBusy) return;
    setIsBusy(true);

    // Disable context cards and mark selection
    setFlowItems((prev) =>
      prev.map((fi) =>
        fi.type === "context-cards" ? { ...fi, disabled: true, selectedLabel: item.label } as FlowItem : fi
      )
    );

    await delay(500);
    addItem({ type: "user", content: `Generate ideas from: ${item.label}` });
    const typingId = addItem({ type: "typing" });

    const prompt = `Generate 5 post ideas based on this context:\n\n[${item.type.toUpperCase()}: ${item.label}]\n${item.content}\n\nFor each idea, give a numbered title in bold and a 2-3 sentence description of the post angle.`;

    await sendMessage({ content: prompt, role: "user" });

    await delay(800);
    removeItem(typingId);

    // Stream the AI response
    const streamingId = addItem({ type: "streaming", content: "" });
    let fullResponse = "";

    await streamAIResponse({
      message: prompt,
      messageHistory: getMessageHistory(),
      onDelta: (chunk) => {
        fullResponse += chunk;
        updateItem(streamingId, { content: fullResponse });
      },
      onDone: async () => {
        removeItem(streamingId);
        if (fullResponse.trim()) {
          await sendMessage({ content: fullResponse, role: "assistant" });
        }
        const ideas = parsePostIdeas(fullResponse);
        if (ideas.length > 0) {
          setPostIdeas(ideas);
          addItem({ type: "ai", content: "Here are 5 post ideas based on your selection:" });
          addItem({ type: "idea-cards", ideas });
        } else {
          addItem({ type: "ai", content: fullResponse });
        }
        setIsBusy(false);
      },
      onError: async (errMsg) => {
        removeItem(streamingId);
        addItem({ type: "ai", content: `⚠️ ${errMsg}` });
        setIsBusy(false);
      },
    });
  }, [isBusy, addItem, removeItem, updateItem, sendMessage]);

  /* ─── Flow: Quick actions (trending, template, etc.) ─── */
  const handleQuickAction = useCallback(async (label: string, message: string) => {
    if (isBusy) return;
    setIsBusy(true);
    setFlowMode("guided");
    setFlowItems([]);

    addItem({ type: "user", content: label });
    const typingId = addItem({ type: "typing" });

    await ensureSession();
    await sendMessage({ content: message, role: "user" });
    if (messages.length === 0) {
      const sid = activeSessionId || "";
      if (sid) await updateTitle({ id: sid, title: label });
    }

    await delay(1800);
    removeItem(typingId);

    const streamingId = addItem({ type: "streaming", content: "" });
    let fullResponse = "";

    await streamAIResponse({
      message,
      messageHistory: getMessageHistory(),
      onDelta: (chunk) => {
        fullResponse += chunk;
        updateItem(streamingId, { content: fullResponse });
      },
      onDone: async () => {
        removeItem(streamingId);
        if (fullResponse.trim()) {
          await sendMessage({ content: fullResponse, role: "assistant" });
        }
        const ideas = parsePostIdeas(fullResponse);
        if (ideas.length > 0) {
          setPostIdeas(ideas);
          addItem({ type: "ai", content: `Here are some ideas for you:` });
          addItem({ type: "idea-cards", ideas });
        } else {
          addItem({ type: "ai", content: fullResponse });
        }
        setIsBusy(false);
      },
      onError: async (errMsg) => {
        removeItem(streamingId);
        addItem({ type: "ai", content: `⚠️ ${errMsg}` });
        setIsBusy(false);
      },
    });
  }, [isBusy, addItem, removeItem, updateItem, ensureSession, sendMessage, updateTitle, activeSessionId, messages]);

  /* ─── Flow: Draft a post idea ─── */
  const handleDraftIdea = useCallback(async (idea: { title: string; body: string }) => {
    if (isBusy) return;
    setIsBusy(true);
    setDraftingIdea(idea);
    setDraftedPost("");
    setPostAnalysis("");

    addItem({ type: "user", content: `Draft post: ${idea.title}` });
    addItem({ type: "drafting" });

    const draftPrompt = `Write a complete Threads post based on this idea:\n\nTitle: ${idea.title}\nConcept: ${idea.body}\n\nWrite only the post text, ready to publish. Use my voice and style. Keep it under 500 characters. Format for mobile readability.`;

    await sendMessage({ content: draftPrompt, role: "user" });

    let fullDraft = "";
    await streamAIResponse({
      message: draftPrompt,
      messageHistory: getMessageHistory(),
      onDelta: (chunk) => { fullDraft += chunk; },
      onDone: async () => {
        if (fullDraft.trim()) {
          await sendMessage({ content: fullDraft, role: "assistant" });
          setDraftedPost(fullDraft);
          setFlowMode("preview");

          // Second AI call for analysis
          const analysisPrompt = `Analyze this Threads post and explain why it works. Break down:\n1. Angle — what perspective does it take?\n2. Hook — why does the opening line work?\n3. Content — what value does it deliver?\n4. Ending — how does it close?\n5. Optional improvements — 2-3 ways to make it stronger\n\nPost: ${fullDraft}\n\nRespond in clean paragraphs under each heading. Be specific and reference the actual content.`;
          let analysisText = "";
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const resp = await fetch(CHAT_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ message: analysisPrompt, message_history: getMessageHistory() }),
            });
            if (resp.ok && resp.body) {
              const reader = resp.body.getReader();
              const decoder = new TextDecoder();
              let buf = "";
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx: number;
                while ((idx = buf.indexOf("\n")) !== -1) {
                  let line = buf.slice(0, idx);
                  buf = buf.slice(idx + 1);
                  if (line.endsWith("\r")) line = line.slice(0, -1);
                  if (!line.startsWith("data: ")) continue;
                  const j = line.slice(6).trim();
                  if (j === "[DONE]") break;
                  try {
                    const p = JSON.parse(j);
                    const c = p.choices?.[0]?.delta?.content;
                    if (c) { analysisText += c; setPostAnalysis(analysisText); }
                  } catch {}
                }
              }
              if (analysisText.trim()) {
                await sendMessage({ content: analysisText, role: "assistant" });
              }
            }
          }
        }
        setIsBusy(false);
      },
      onError: async (errMsg) => {
        toast({ title: "Error", description: errMsg, variant: "destructive" });
        setFlowMode("guided");
        setIsBusy(false);
      },
    });
  }, [isBusy, addItem, sendMessage]);

  /* ─── Regenerate in preview ─── */
  const handleRegenerate = async () => {
    if (!draftingIdea || isRegenerating) return;
    setIsRegenerating(true);
    setPostAnalysis("");

    const draftPrompt = `Write a completely different version of this Threads post idea:\n\nTitle: ${draftingIdea.title}\nConcept: ${draftingIdea.body}\n\nWrite only the post text, ready to publish. Use my voice and style. Keep it under 500 characters. Make it noticeably different from the previous version.`;

    let fullText = "";
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsRegenerating(false); return; }

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ message: draftPrompt, message_history: getMessageHistory() }),
    });

    if (resp.ok && resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const p = JSON.parse(j);
            const c = p.choices?.[0]?.delta?.content;
            if (c) { fullText += c; setDraftedPost(fullText); }
          } catch {}
        }
      }
      if (fullText.trim()) {
        await sendMessage({ content: fullText, role: "assistant" });
        // Run analysis
        const analysisPrompt = `Analyze this Threads post and explain why it works. Break down:\n1. Angle\n2. Hook\n3. Content\n4. Ending\n5. Optional improvements\n\nPost: ${fullText}\n\nBe specific.`;
        let analysisText = "";
        const resp2 = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ message: analysisPrompt, message_history: [] }),
        });
        if (resp2.ok && resp2.body) {
          const reader = resp2.body.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, idx);
              buf = buf.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const j = line.slice(6).trim();
              if (j === "[DONE]") break;
              try {
                const p = JSON.parse(j);
                const c = p.choices?.[0]?.delta?.content;
                if (c) { analysisText += c; setPostAnalysis(analysisText); }
              } catch {}
            }
          }
        }
      }
    }
    setIsRegenerating(false);
  };

  /* ─── Free-form chat send ─── */
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isBusy) return;
    setInput("");

    if (flowMode === "empty" || flowMode === "chat") {
      // Switch to chat mode with DB messages
      setFlowMode("chat");
      setFlowItems([]);
      const sessionId = await ensureSession();
      await sendMessage({ content: msg, role: "user" });
      if (messages.length === 0) {
        await updateTitle({ id: sessionId, title: msg.slice(0, 50) + (msg.length > 50 ? "..." : "") });
      }
      setIsBusy(true);
      // We'll use a temporary streaming state for chat mode
      let fullResponse = "";
      await refetch();
      await streamAIResponse({
        message: msg,
        messageHistory: getMessageHistory(),
        onDelta: (chunk) => {
          fullResponse += chunk;
          // For chat mode, we update a streaming state
          setFlowItems([{ id: "chat-stream", type: "streaming", content: fullResponse }]);
        },
        onDone: async () => {
          setFlowItems([]);
          if (fullResponse.trim()) {
            await sendMessage({ content: fullResponse, role: "assistant" });
          }
          await refetch();
          setIsBusy(false);
        },
        onError: async (errMsg) => {
          setFlowItems([]);
          toast({ title: "Error", description: errMsg, variant: "destructive" });
          await sendMessage({ content: `⚠️ ${errMsg}`, role: "assistant" });
          await refetch();
          setIsBusy(false);
        },
      });
    } else if (flowMode === "guided") {
      // In guided mode, user typed a message — switch to chat
      addItem({ type: "user", content: msg });
      setIsBusy(true);
      await sendMessage({ content: msg, role: "user" });

      const streamingId = addItem({ type: "streaming", content: "" });
      let fullResponse = "";
      await streamAIResponse({
        message: msg,
        messageHistory: getMessageHistory(),
        onDelta: (chunk) => {
          fullResponse += chunk;
          updateItem(streamingId, { content: fullResponse });
        },
        onDone: async () => {
          removeItem(streamingId);
          if (fullResponse.trim()) {
            await sendMessage({ content: fullResponse, role: "assistant" });
            addItem({ type: "ai", content: fullResponse });
          }
          setIsBusy(false);
        },
        onError: async (errMsg) => {
          removeItem(streamingId);
          addItem({ type: "ai", content: `⚠️ ${errMsg}` });
          setIsBusy(false);
        },
      });
    }
  }, [input, isBusy, flowMode, ensureSession, sendMessage, updateTitle, messages, refetch, addItem, removeItem, updateItem]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleNewChat = async () => {
    const session = await createSession();
    setActiveSessionId(session.id);
    setHistoryOpen(false);
    setFlowMode("empty");
    setFlowItems([]);
    setPostIdeas([]);
    setDraftedPost("");
    setPostAnalysis("");
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setHistoryOpen(false);
  };

  const handleBackFromPreview = () => {
    setFlowMode("guided");
    setDraftedPost("");
    setPostAnalysis("");
  };

  const grouped = groupSessionsByDate(sessions);

  /* ─── Render flow item ─── */
  const renderFlowItem = (item: FlowItem) => {
    switch (item.type) {
      case "user":
        return (
          <div key={item.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-xl px-4 py-3 bg-primary/15 text-foreground">
              <p className="text-sm whitespace-pre-wrap">{item.content}</p>
            </div>
          </div>
        );
      case "ai":
        return (
          <div key={item.id} className="flex justify-start">
            <div className="max-w-[85%] bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
                <span className="text-xs font-medium text-muted-foreground">Threadable</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{item.content}</p>
            </div>
          </div>
        );
      case "typing":
        return (
          <div key={item.id} className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
                <span className="text-xs font-medium text-muted-foreground">Threadable</span>
              </div>
              <TypingIndicator />
            </div>
          </div>
        );
      case "streaming":
        return (
          <div key={item.id} className="flex justify-start">
            <div className="max-w-[85%] bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
                <span className="text-xs font-medium text-muted-foreground">Threadable</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{item.content || "..."}</p>
            </div>
          </div>
        );
      case "context-cards":
        return (
          <div key={item.id} className="flex justify-start">
            <div className="max-w-[90%] w-full">
              <InlineContextCards
                contextData={contextData}
                disabled={item.disabled}
                selectedLabel={item.selectedLabel}
                onSelect={handleContextSelect}
              />
            </div>
          </div>
        );
      case "idea-cards":
        return (
          <div key={item.id} className="flex justify-start">
            <div className="max-w-[90%] w-full space-y-3">
              {item.ideas.map((idea, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{i + 1}. {idea.title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{idea.body}</p>
                  <button
                    onClick={() => handleDraftIdea(idea)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-1 disabled:opacity-50"
                  >
                    📄 Draft this post
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case "drafting":
        return (
          <div key={item.id} className="flex justify-start">
            <div className="max-w-[85%]">
              <DraftingProgress />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  /* ─── Render main chat area ─── */
  const renderMainContent = () => {
    if (flowMode === "preview") {
      return (
        <PostPreviewSplit
          postContent={draftedPost}
          analysis={postAnalysis}
          displayName={profile?.display_name || user?.email?.split("@")[0] || "User"}
          username={profile?.threads_username || user?.email?.split("@")[0] || "user"}
          profilePicUrl={profile?.threads_profile_picture_url}
          onBack={handleBackFromPreview}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
        />
      );
    }

    return (
      <div className="max-w-[700px] mx-auto px-4 py-6 space-y-4">
        {/* Empty state landing */}
        {flowMode === "empty" && (
          <div className="flex flex-col items-center justify-center pt-16 pb-8">
            <img src={threadableIcon} alt="Threadable" className="h-14 w-14 rounded-xl mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-2">What are we creating today?</h2>
            <p className="text-sm text-muted-foreground mb-4">Ask Threadable to brainstorm, draft, or refine your content.</p>
          </div>
        )}

        {/* Chat mode: show DB messages */}
        {flowMode === "chat" && messages.map((m) => (
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

        {/* Flow items (guided mode + chat streaming) */}
        {flowItems.map(renderFlowItem)}

        {/* Chat mode typing indicator */}
        {flowMode === "chat" && isBusy && flowItems.length === 0 && (
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

        <div style={{ height: 1 }} />
      </div>
    );
  };

  const showInput = flowMode !== "preview";

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
                          if (activeSessionId === s.id) { setActiveSessionId(null); setFlowMode("empty"); }
                        }}
                      />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main chat area */}
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

          {/* Messages / flow content */}
          <div className="flex-1 overflow-auto" ref={scrollRef}>
            {renderMainContent()}
          </div>

          {/* Input area */}
          {showInput && (
            <div className="border-t border-border bg-background">
              <div className="max-w-[600px] mx-auto px-4 py-3">
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
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-end">
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isBusy}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Quick actions — only in empty state */}
                {flowMode === "empty" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-2 flex-wrap justify-center">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => {
                            if (action.action === "ideas") {
                              handlePostIdeasAction();
                            } else if (action.message) {
                              handleQuickAction(action.label, action.message);
                            }
                          }}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                        >
                          <span>{action.icon}</span>
                          <span>{action.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-center">
                      <button
                        onClick={() => setShowMore(!showMore)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {showMore ? "Show less" : "Show more"}
                      </button>
                    </div>

                    {showMore && (
                      <div className="flex gap-2 flex-wrap justify-center">
                        {MORE_ACTIONS.map((action) => (
                          <button
                            key={action.label}
                            onClick={() => handleQuickAction(action.label, action.message)}
                            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                          >
                            <span>{action.icon}</span>
                            <span>{action.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Chat;
