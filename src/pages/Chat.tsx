import { useState, useRef, useEffect, useCallback } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, ArrowUp, MessageSquare, ChevronDown, ChevronUp, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatSessions, useChatMessages, type ChatSession, type ChatMessageMetadata } from "@/hooks/useChatData";
import { useChatContextData } from "@/hooks/useChatContextData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import threadableIcon from "@/assets/threadable-icon.png";
import { InlineContextCards } from "@/components/chat/ContextSelection";
import { parsePostIdeas } from "@/components/chat/PostIdeasView";
import { DraftingProgress } from "@/components/chat/DraftingProgress";
import { PostPreviewSplit, tryParseAnalysisJSON, type AnalysisData } from "@/components/chat/PostPreviewSplit";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ─── Flow item types ─── */
type FlowItem =
  | { id: string; type: "user"; content: string }
  | { id: string; type: "ai"; content: string }
  | { id: string; type: "typing" }
  | { id: string; type: "context-cards"; disabled: boolean; selectedLabel?: string }
  | { id: string; type: "idea-cards"; ideas: { title: string; body: string; archetype?: string; funnelStage?: string }[] }
  | { id: string; type: "drafting" }
  | { id: string; type: "streaming"; content: string };

const QUICK_ACTIONS = [
  { icon: "💡", label: "Give post ideas", action: "ideas" as const },
  { icon: "📈", label: "What's trending", action: "trending" as const, message: "Look at the COMPETITOR INSIGHTS section of my context.\n\nIF competitor posts exist: Show me the top 3 competitor posts by engagement rate. For each one, show the original post text and who wrote it. Format as:\n\n**1. @username — Short description of the post angle**\nOriginal post: \"[paste the full competitor post text]\"\nViews: X | Engagement: X%\nArchetype: [which of MY archetypes could rewrite this]\nFunnel Stage: TOF\n\nThen ask: \"Which one do you want me to rewrite in your voice?\"\n\nIF NO competitor posts exist: Respond conversationally (do NOT use numbered bold titles or the **1. Title** format). Tell the user you don't have trending data from their niche yet and suggest they either paste a viral post from their niche for you to rewrite, or go to the Analyze page to add accounts to study. Keep it to 2-3 sentences.\n\nDo NOT generate new post ideas from my own data — that's what 'Give post ideas' is for. This action is specifically about surfacing other people's top content for me to rewrite." },
  { icon: "📋", label: "Give a template", action: "template" as const, message: "Write 5 complete, ready-to-publish Threads posts — each one following a different archetype.\n\nIMPORTANT: Study my top-performing posts. Each post should replicate the emotional triggers and hook patterns that drove my highest engagement — but with completely new content.\n\nFor each post:\n- Use a proven hook pattern from my top posts (provocative statement, specific number, confession, vulnerability)\n- Hit an emotional trigger that's worked before (vulnerability, authority, contrarian shock, relatability)\n- Use a different archetype for each\n- Fill in ALL content with my real stories, numbers, and experiences — no brackets\n- Format for mobile: short paragraphs, line breaks\n\nFormat:\n**1. Archetype Name**\nthen the full post text." },
];

const MORE_ACTIONS = [
  { icon: "♻️", label: "Repurpose a post", message: "Take my top performing post and give me 3 ways to repurpose it using different archetypes. Format as numbered ideas with a bold title and description." },
  { icon: "🔝", label: "Write a TOF post", message: "Write a top-of-funnel reach post designed for maximum reach. Pick whichever of my discovered archetypes is best suited for a broad-appeal, awareness-stage post. Use a real story from my Identity and make the hook pattern match what's worked in my top posts." },
  { icon: "🎯", label: "Write a BOF post", message: "Write a bottom-of-funnel conversion post that drives toward my main goal. Make it feel natural, not salesy." },
  { icon: "✏️", label: "Improve a draft", message: "I have a draft post I want to improve. I'll paste it and you score it against my content preferences and suggest improvements." },
  { icon: "📅", label: "Plan tomorrow's content", message: "Based on my content plan and funnel strategy, what should I post tomorrow? Give me 2-3 options with hooks." },
  { icon: "🔄", label: "Rewrite a post", message: `I want to rewrite someone else's viral post in my own voice.

Here's what I need you to do when I paste the post:

1. ANALYZE the source post:
   - What hook type does it use? (provocative statement, specific number, confession, question, "Nobody tells you", list, contrarian take)
   - What emotional trigger drives it? (fear of missing out, vulnerability, authority flex, contrarian shock, relatability, aspiration)
   - What structure does it follow? (hook → story → lesson, hook → proof → CTA, hook → list → punchline, hook → contrast → insight)
   - Why would someone stop scrolling for this?

2. MAP to my content world:
   - Which of my archetypes fits this angle best?
   - What stories, numbers, or experiences from my Identity match this theme?
   - What funnel stage would this serve for my audience?

3. REWRITE as 3 variations:
   - Each variation should use a DIFFERENT archetype from my discovered archetypes
   - Each should use DIFFERENT stories and data points from my Identity
   - Keep the same emotional intensity and hook pattern from the original, but make it 100% mine
   - Use my real voice, real numbers, real experiences — no brackets, no placeholders
   - Stay under 500 characters unless the content demands more

Format EXACTLY like this for each variation:

**1. Archetype Name**
Complete post text using my voice, stories, and data

Archetype: archetype name
Funnel Stage: TOF/MOF/BOF

**2. Archetype Name**
Complete post text using my voice, stories, and data

Archetype: archetype name
Funnel Stage: TOF/MOF/BOF

**3. Archetype Name**
Complete post text using my voice, stories, and data

Archetype: archetype name
Funnel Stage: TOF/MOF/BOF

Now please ask me to paste the post I want to rewrite.` },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-with-threadable`;

function groupSessionsByDate(sessions: ChatSession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const pinned = sessions.filter((s) => s.pinned).sort((a, b) => {
    const at = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
    const bt = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
    return bt - at;
  });

  const unpinned = sessions.filter((s) => !s.pinned);
  const groups: { label: string; sessions: ChatSession[] }[] = [];

  if (pinned.length > 0) groups.push({ label: "📌 Pinned", sessions: pinned });

  const dateGroups: { label: string; sessions: ChatSession[] }[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];

  for (const s of unpinned) {
    const d = new Date(s.created_at);
    if (d >= today) dateGroups[0].sessions.push(s);
    else if (d >= yesterday) dateGroups[1].sessions.push(s);
    else if (d >= weekAgo) dateGroups[2].sessions.push(s);
    else dateGroups[3].sessions.push(s);
  }

  return [...groups, ...dateGroups.filter((g) => g.sessions.length > 0)];
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
  if (textBuffer.trim()) {
    for (const raw of textBuffer.split("\n")) {
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

/* ─── Auto-naming helpers ─── */
function generateAutoTitle(action: string, contextLabel?: string): string {
  if (action === "ideas" && contextLabel) {
    const short = contextLabel.length > 40 ? contextLabel.slice(0, 40) + "..." : contextLabel;
    return `Post ideas: ${short}`;
  }
  if (action === "ideas") return "Post ideas";
  if (action === "trending") return "Trending topics";
  if (action === "template") return "Post templates";
  return action.slice(0, 50);
}

function generateTitleFromMessage(msg: string): string {
  // Remove common prefixes
  let clean = msg.replace(/^(hey|hi|hello|help me|can you|please|i want to|i need to)\s*/i, "").trim();
  if (clean.length === 0) clean = msg;
  // Capitalize first letter
  clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  return clean.length > 50 ? clean.slice(0, 50) + "..." : clean;
}

/* ─── Main component ─── */
const Chat = () => {
  usePageTitle("Chat", "Ask Threadable AI");
  const { user } = useAuth();
  const { sessions, isLoading: sessionsLoading, createSession, updateTitle, togglePin, deleteSession } = useChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const { messages, isLoading: messagesLoading, sendMessage, updateMessageMetadata, refetch } = useChatMessages(activeSessionId);
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
  const [parsedAnalysisData, setParsedAnalysisData] = useState<AnalysisData | null>(null);
  const [draftingIdea, setDraftingIdea] = useState<{ title: string; body: string } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [draftMessageId, setDraftMessageId] = useState<string | null>(null);

  // Pending action ref — survives re-renders caused by session creation
  const pendingActionRef = useRef<{ type: string; label?: string; message?: string } | null>(null);

  // Sidebar editing
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // History preview (for loading drafts from history)
  const [historyPreviewData, setHistoryPreviewData] = useState<{
    postText: string;
    analysis: AnalysisData | null;
    analysisRaw: string;
    status: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Profile for Threads preview
  const profileQuery = useQuery({
    queryKey: ["user-profile-chat", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, threads_username, threads_profile_picture_url, threads_access_token")
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

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // On session change, detect mode — but skip reset if a pending action is queued
  // or if we're in guided/preview mode (those manage their own flow items)
  useEffect(() => {
    if (pendingActionRef.current && activeSessionId) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action.type === "ideas") {
        handlePostIdeasAction();
      } else if (action.type === "quick" && action.label && action.message) {
        handleQuickAction(action.label, action.message);
      } else if (action.type === "more" && action.label && action.message) {
        handleQuickAction(action.label, action.message);
      }
      return;
    }

    // Don't reset flow items if we're in guided or preview mode — those modes
    // manage their own items and a messages.length change (from saving to DB)
    // should not wipe them out.
    if (flowMode === "guided" || flowMode === "preview") return;

    setHistoryPreviewData(null);
    if (messages.length > 0) {
      setFlowMode("chat");
    } else {
      setFlowMode("empty");
    }
    setFlowItems([]);
    setPostIdeas([]);
    setDraftedPost("");
    setPostAnalysis("");
    setParsedAnalysisData(null);
    setDraftingIdea(null);
    setDraftMessageId(null);
  }, [activeSessionId, messages.length]);

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
        const autoTitle = generateTitleFromMessage(msg);
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

    // If no session, store pending action and create session — the useEffect will re-trigger this
    if (!activeSessionId) {
      pendingActionRef.current = { type: "ideas" };
      createSession().then((s) => setActiveSessionId(s.id));
      return;
    }

    setIsBusy(true);
    setFlowMode("guided");
    setFlowItems([]);
    setHistoryPreviewData(null);

    addItem({ type: "user", content: "Give me post ideas" });
    const typingId = addItem({ type: "typing" });

    await sendMessage({ content: "Give me post ideas", role: "user" });
    await updateTitle({ id: activeSessionId, title: "Post ideas" });

    await delay(1500);
    removeItem(typingId);
    addItem({ type: "ai", content: "💡 What do you want your post ideas to be about?\nPick one to get started:" });
    addItem({ type: "context-cards", disabled: false });

    setIsBusy(false);
  }, [isBusy, activeSessionId, addItem, removeItem, createSession, sendMessage, updateTitle]);

  /* ─── Flow: Context item selected (single select) ─── */
  const handleContextSelect = useCallback(async (item: { type: string; label: string; content: string }) => {
    if (isBusy) return;
    setIsBusy(true);

    // Update session title with context
    if (activeSessionId) {
      const title = generateAutoTitle("ideas", item.label);
      await updateTitle({ id: activeSessionId, title });
    }

    setFlowItems((prev) =>
      prev.map((fi) =>
        fi.type === "context-cards" ? { ...fi, disabled: true, selectedLabel: item.label } as FlowItem : fi
      )
    );

    await delay(500);
    addItem({ type: "user", content: `Post ideas from: ${item.label}` });
    const typingId = addItem({ type: "typing" });

    // Short visible label for user bubble; full context goes to AI only
    const userLabel = `Post ideas from: ${item.label}`;

    // Detect context type and add intent guidance
    let intentGuidance = '';
    if (item.type === 'personal_info' || item.type === 'story') {
      intentGuidance = `\nThis is a PERSONAL topic. Write posts that are authentic, vulnerable, and human.\nDo NOT force business metrics, client results, or revenue numbers into every post.\nSome posts can connect personal experience to professional lessons, but at least 3 out of 5 should focus on the emotional resonance, identity, values, memories, growth moments, family, culture, or lessons from life.\nPersonal posts that resonate emotionally often outperform business posts.`;
    } else if (item.type === 'offer' || item.type === 'sales_funnel') {
      intentGuidance = `\nThis is a BUSINESS topic. Use specific metrics, client results, revenue numbers, and tactical insights.\nInclude CTAs when appropriate. Be strategic and data-driven.`;
    } else if (item.type === 'knowledge') {
      intentGuidance = `\nThis is based on external knowledge/research. Use the information to create insightful, educational content.\nReference the source material to add depth and credibility.`;
    } else if (item.type === 'post') {
      intentGuidance = `\nThis is based on an existing post that performed well. Create new posts that explore different angles of the same theme.\nStudy what made the original post work and replicate those patterns with fresh content.`;
    } else {
      intentGuidance = `\nWrite posts that naturally fit this topic. If it's personal, keep it personal. If it's business, use business data.`;
    }

    const prompt = `Write 5 complete, ready-to-publish Threads posts based on this context:\n\n${item.type.toUpperCase()}: ${item.label}\n${item.content}\n${intentGuidance}\n\nEach post MUST use a completely different angle — matched to the topic above.\n\nStudy my top-performing posts for emotional triggers and hook patterns, but use FRESH content — do NOT recycle the same 3-4 stories.\n\nCRITICAL: Every post must be 100% finished — real stories, real numbers, real examples from my data. Do NOT use square brackets or placeholders anywhere.\n\nFor each post:\n- Use a proven hook pattern from my top posts (provocative statement, specific number, confession, vulnerability)\n- Hit an emotional trigger that's worked before (vulnerability, authority, contrarian shock, relatability)\n- Start with **1. Archetype Name** as the header\n- Then write the complete post text underneath\n- Each post should use a different archetype\n- Use my real stories, real dollar amounts, and real experiences\n- Stay under 500 characters unless the content requires more (max 2200)\n- Follow my writing style and content preferences\n- Format for mobile: short paragraphs, line breaks between thoughts\n- No hashtags unless content preferences say to use them\n- Sound like me, not like AI`;

    await sendMessage({ content: userLabel, role: "user" });

    await delay(800);
    removeItem(typingId);

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
        if (ideas && ideas.length >= 2) {
          setPostIdeas(ideas);
          addItem({ type: "ai", content: `Here are ${ideas.length} post ideas based on your selection:` });
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
  }, [isBusy, activeSessionId, addItem, removeItem, updateItem, sendMessage, updateTitle]);

  /* ─── Flow: Quick actions (trending, template, etc.) ─── */
  const handleQuickAction = useCallback(async (label: string, message: string) => {
    if (isBusy) return;

    // If no session, store pending action and create session — the useEffect will re-trigger this
    if (!activeSessionId) {
      pendingActionRef.current = { type: "quick", label, message };
      createSession().then((s) => setActiveSessionId(s.id));
      return;
    }

    setIsBusy(true);
    setFlowMode("guided");
    setFlowItems([]);
    setHistoryPreviewData(null);

    addItem({ type: "user", content: label });
    const typingId = addItem({ type: "typing" });

    await sendMessage({ content: message, role: "user" });
    await updateTitle({ id: activeSessionId, title: generateAutoTitle(label.toLowerCase().includes("trending") ? "trending" : label.toLowerCase().includes("template") ? "template" : label) });

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
        if (ideas && ideas.length >= 2) {
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
  }, [isBusy, activeSessionId, addItem, removeItem, updateItem, createSession, sendMessage, updateTitle]);

  /* ─── Flow: Draft a post idea (AI generates full post from idea, then analyzes it) ─── */
  const handleDraftIdea = useCallback(async (idea: { title: string; body: string }) => {
    if (isBusy) return;
    setIsBusy(true);
    setDraftingIdea(idea);
    setDraftedPost("");
    setPostAnalysis("");
    setParsedAnalysisData(null);
    setHistoryPreviewData(null);
    setDraftMessageId(null);

    addItem({ type: "user", content: `Draft: ${idea.title}` });
    addItem({ type: "drafting" });

    await sendMessage({ content: `Draft: ${idea.title}`, role: "user" });

    setFlowMode("preview");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setIsBusy(false); return; }

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };

    // Step 1: AI generates the full post from the idea
    const draftPrompt = `Write a complete, ready-to-publish Threads post based on this idea:\n\nTitle: ${idea.title}\nDescription: ${idea.body}\n\nWrite ONLY the post text — no labels, no quotes, no explanation, no "Option 1" headers. Just the single best version of this post, ready to copy-paste to Threads. Use my voice, stories, and real data. Keep it under 500 characters. Start with a scroll-stopping hook.`;

    let fullText = "";
    const genResp = await fetch(CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: draftPrompt, message_history: getMessageHistory() }),
    });

    if (genResp.ok && genResp.body) {
      const reader = genResp.body.getReader();
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
    }

    // Fallback: if generation failed, use the idea body as-is
    if (!fullText.trim()) {
      fullText = idea.body;
      setDraftedPost(fullText);
    }

    // Step 2: Analyze the generated post
    const analysisPrompt = `Analyze this Threads post. Respond in EXACTLY this JSON format with no preamble, no markdown, no explanation:\n\n{"angle": "2-3 sentences about what perspective the post takes", "hook": "2-3 sentences about why the opening line works", "content": "2-3 sentences about what value the post delivers", "ending": "2-3 sentences about how it closes", "improvements": ["improvement 1", "improvement 2", "improvement 3"]}\n\nPost to analyze:\n${fullText}`;

    let analysisText = "";
    const analysisResp = await fetch(CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: analysisPrompt, message_history: [] }),
    });

    if (analysisResp.ok && analysisResp.body) {
      const reader = analysisResp.body.getReader();
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

    const parsed = tryParseAnalysisJSON(analysisText);
    setParsedAnalysisData(parsed);

    const metadata: ChatMessageMetadata = {
      type: "drafted_post",
      post_text: fullText,
      analysis: parsed,
      status: "draft",
      queue_id: null,
      published_at: null,
    };
    const savedMsg = await sendMessage({ content: analysisText || fullText, role: "assistant", metadata });
    setDraftMessageId(savedMsg.id);

    setIsBusy(false);
  }, [isBusy, addItem, sendMessage]);

  /* ─── Handle status change from PostPreviewSplit ─── */
  const handlePostStatusChange = useCallback(async (status: string, queueId?: string) => {
    const msgId = draftMessageId;
    if (!msgId) return;
    try {
      await updateMessageMetadata({
        messageId: msgId,
        metadata: {
          status: status as any,
          queue_id: queueId || null,
          published_at: status === "published" ? new Date().toISOString() : null,
        },
      });
    } catch {}
  }, [draftMessageId, updateMessageMetadata]);

  /* ─── Regenerate in preview ─── */
  const handleRegenerate = async () => {
    if (!draftingIdea || isRegenerating) return;
    setIsRegenerating(true);
    setPostAnalysis("");
    setParsedAnalysisData(null);

    const draftPrompt = `Write a completely different version of this Threads post. Same topic and angle, but different execution.\n\nOriginal post:\n${draftedPost}\n\nWrite only the post text, ready to publish. Use my voice and style. Keep it under 500 characters. Make it noticeably different from the previous version.`;

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
        // Run analysis
        const analysisPrompt = `Analyze this Threads post. Respond in EXACTLY this JSON format with no preamble, no markdown, no explanation:\n\n{"angle": "2-3 sentences about what perspective the post takes", "hook": "2-3 sentences about why the opening line works", "content": "2-3 sentences about what value the post delivers", "ending": "2-3 sentences about how it closes", "improvements": ["improvement 1", "improvement 2", "improvement 3"]}\n\nPost to analyze:\n${fullText}`;
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

          const parsed = tryParseAnalysisJSON(analysisText);
          setParsedAnalysisData(parsed);

          // Save new draft with metadata
          const metadata: ChatMessageMetadata = {
            type: "drafted_post",
            post_text: fullText,
            analysis: parsed,
            status: "draft",
            queue_id: null,
            published_at: null,
          };
          const savedMsg = await sendMessage({ content: analysisText || fullText, role: "assistant", metadata });
          setDraftMessageId(savedMsg.id);
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
      setFlowMode("chat");
      setFlowItems([]);
      setHistoryPreviewData(null);
      const sessionId = await ensureSession();
      await sendMessage({ content: msg, role: "user" });
      if (messages.length === 0) {
        await updateTitle({ id: sessionId, title: generateTitleFromMessage(msg) });
      }
      setIsBusy(true);
      let fullResponse = "";
      await refetch();
      await streamAIResponse({
        message: msg,
        messageHistory: getMessageHistory(),
        onDelta: (chunk) => {
          fullResponse += chunk;
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
            const ideas = parsePostIdeas(fullResponse);
            if (ideas && ideas.length >= 2) {
              setPostIdeas(ideas);
              addItem({ type: "ai", content: `Here are ${ideas.length} variations for you:` });
              addItem({ type: "idea-cards", ideas });
            } else {
              addItem({ type: "ai", content: fullResponse });
            }
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
    setParsedAnalysisData(null);
    setHistoryPreviewData(null);
    setDraftMessageId(null);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setHistoryOpen(false);
  };

  const handleBackFromPreview = () => {
    // If we were viewing from history, go back to chat mode
    if (historyPreviewData) {
      setFlowMode("chat");
    } else {
      setFlowMode("guided");
    }
    setDraftedPost("");
    setPostAnalysis("");
    setParsedAnalysisData(null);
    setHistoryPreviewData(null);
  };

  /* ─── Sidebar: rename ─── */
  const handleStartRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameValue(session.title);
  };

  const handleFinishRename = async () => {
    if (renamingId && renameValue.trim()) {
      await updateTitle({ id: renamingId, title: renameValue.trim() });
    }
    setRenamingId(null);
  };

  /* ─── Sidebar: pin ─── */
  const handleTogglePin = async (session: ChatSession) => {
    if (!session.pinned) {
      const pinnedCount = sessions.filter((s) => s.pinned).length;
      if (pinnedCount >= 5) {
        toast({ title: "Pin limit reached", description: "You can pin up to 5 chats. Unpin one first." });
        return;
      }
    }
    await togglePin({ id: session.id, pinned: !session.pinned });
  };

  /* ─── Sidebar: delete ─── */
  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteSession(deleteConfirmId);
    if (activeSessionId === deleteConfirmId) {
      setActiveSessionId(null);
      setFlowMode("empty");
    }
    setDeleteConfirmId(null);
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
                <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Idea {i + 1}: {idea.title}</h4>
                  <div className="max-h-[300px] overflow-y-auto">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {idea.body}
                    </p>
                  </div>
                  {((idea as any).archetype || (idea as any).funnelStage) && (
                    <div className="flex gap-2 flex-wrap">
                      {(idea as any).archetype && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {(idea as any).archetype}
                        </span>
                      )}
                      {(idea as any).funnelStage && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border">
                          {(idea as any).funnelStage}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => handleDraftIdea(idea)}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors pt-1 disabled:opacity-50 min-h-[44px] w-full md:w-auto"
                  >
                    📄 Draft post
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
    // Preview from history
    if (flowMode === "preview" && historyPreviewData) {
      return (
        <PostPreviewSplit
          postContent={historyPreviewData.postText}
          analysis={historyPreviewData.analysisRaw}
          parsedAnalysisOverride={historyPreviewData.analysis}
          displayName={profile?.display_name || user?.email?.split("@")[0] || "User"}
          username={profile?.threads_username || user?.email?.split("@")[0] || "user"}
          profilePicUrl={profile?.threads_profile_picture_url}
          threadsConnected={!!profile?.threads_access_token}
          onBack={handleBackFromPreview}
          readOnly={historyPreviewData.status === "published"}
          initialStatus={historyPreviewData.status as any}
          onStatusChange={handlePostStatusChange}
        />
      );
    }

    // Live preview (just drafted)
    if (flowMode === "preview") {
      return (
        <PostPreviewSplit
          postContent={draftedPost}
          analysis={postAnalysis}
          parsedAnalysisOverride={parsedAnalysisData}
          displayName={profile?.display_name || user?.email?.split("@")[0] || "User"}
          username={profile?.threads_username || user?.email?.split("@")[0] || "user"}
          profilePicUrl={profile?.threads_profile_picture_url}
          threadsConnected={!!profile?.threads_access_token}
          onBack={handleBackFromPreview}
          onRegenerate={handleRegenerate}
          isRegenerating={isRegenerating}
          onStatusChange={handlePostStatusChange}
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

        {/* Chat mode: render messages with inline split-screen for drafted posts */}
        {flowMode === "chat" && messages.map((m, idx) => {
          // Check if this is a drafted post (via metadata)
          if (m.metadata?.type === "drafted_post") {
            const meta = m.metadata;
            return (
              <div key={m.id}>
                <PostPreviewSplit
                  postContent={meta.post_text}
                  analysis={m.content}
                  parsedAnalysisOverride={meta.analysis}
                  displayName={profile?.display_name || user?.email?.split("@")[0] || "User"}
                  username={profile?.threads_username || user?.email?.split("@")[0] || "user"}
                  profilePicUrl={profile?.threads_profile_picture_url}
                  threadsConnected={!!profile?.threads_access_token}
                  onBack={() => {}}
                  readOnly={meta.status === "published"}
                  initialStatus={meta.status}
                  onStatusChange={(status, queueId) => {
                    updateMessageMetadata({ messageId: m.id, metadata: { status: status as any, queue_id: queueId || null, published_at: status === "published" ? new Date().toISOString() : null } });
                  }}
                />
              </div>
            );
          }

          // Skip analysis messages that are linked to a drafted post above
          if (m.metadata?.type === "post_analysis") return null;

          // Fallback detection: if no metadata, check if this AI message looks like a draft
          // followed by an analysis message
          if (m.role === "assistant" && !m.metadata?.type) {
            const nextMsg = messages[idx + 1];
            const looksLikeDraft = m.content.length < 2200 && m.content.length > 20;
            const nextIsAnalysis = nextMsg?.role === "assistant" && !nextMsg.metadata?.type &&
              (nextMsg.content.includes("Angle") && nextMsg.content.includes("Hook") && nextMsg.content.includes("Content"));

            if (looksLikeDraft && nextIsAnalysis) {
              const parsed = tryParseAnalysisJSON(nextMsg.content);
              return (
                <div key={m.id}>
                  <PostPreviewSplit
                    postContent={m.content}
                    analysis={nextMsg.content}
                    parsedAnalysisOverride={parsed}
                    displayName={profile?.display_name || user?.email?.split("@")[0] || "User"}
                    username={profile?.threads_username || user?.email?.split("@")[0] || "user"}
                    profilePicUrl={profile?.threads_profile_picture_url}
                    threadsConnected={!!profile?.threads_access_token}
                    onBack={() => {}}
                    onStatusChange={(status, queueId) => {}}
                  />
                </div>
              );
            }

            // Skip if this message was consumed as analysis by the previous draft
            if (idx > 0) {
              const prevMsg = messages[idx - 1];
              const prevIsDraft = prevMsg?.role === "assistant" && prevMsg.content.length < 2200 && prevMsg.content.length > 20;
              const thisIsAnalysis = m.content.includes("Angle") && m.content.includes("Hook") && m.content.includes("Content");
              if (prevIsDraft && thisIsAnalysis) return null;
            }

            // Try parsing as idea cards — works for BOTH "post ideas" and "template" responses
            const parsedIdeas = parsePostIdeas(m.content);
            if (parsedIdeas && parsedIdeas.length >= 2) {
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[90%] w-full space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <img src={threadableIcon} alt="" className="h-5 w-5 rounded" />
                      <span className="text-xs font-medium text-muted-foreground">Threadable</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">Here are {parsedIdeas.length} post ideas:</p>
                    {parsedIdeas.map((idea, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <h4 className="text-sm font-semibold text-foreground">Idea {i + 1}: {idea.title}</h4>
                        <div className="max-h-[300px] overflow-y-auto">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {idea.body}
                          </p>
                        </div>
                        {(idea.archetype || idea.funnelStage) && (
                          <div className="flex gap-2 flex-wrap">
                            {idea.archetype && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                {idea.archetype}
                              </span>
                            )}
                            {idea.funnelStage && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border">
                                {idea.funnelStage}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleDraftIdea(idea)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors pt-1 disabled:opacity-50 min-h-[44px] w-full md:w-auto"
                        >
                          📄 Draft post
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          }

          // Regular message rendering
          return (
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
                {/* "View as preview" button for short AI messages that look like posts */}
                {m.role === "assistant" && m.content.length > 20 && m.content.length < 600 && (
                  <button
                    onClick={() => {
                      setHistoryPreviewData({
                        postText: m.content,
                        analysis: null,
                        analysisRaw: "",
                        status: "draft",
                      });
                      setFlowMode("preview");
                    }}
                    className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
                  >
                    👁️ View as post preview
                  </button>
                )}
              </div>
            </div>
          );
        })}

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
                    <div key={s.id} className="group relative">
                      {renamingId === s.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleFinishRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleFinishRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-xs bg-background border border-primary/50 text-foreground focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => handleSelectSession(s.id)}
                          className={cn(
                            "w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors truncate flex items-center gap-1 pr-7",
                            s.id === activeSessionId
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          )}
                        >
                          {s.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-primary/60" />}
                          <span className="truncate">{s.title}</span>
                        </button>
                      )}
                      {renamingId !== s.id && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent">
                                <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => handleStartRename(s)}>
                                <Pencil className="h-3 w-3 mr-2" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTogglePin(s)}>
                                {s.pinned ? (
                                  <><PinOff className="h-3 w-3 mr-2" /> Unpin</>
                                ) : (
                                  <><Pin className="h-3 w-3 mr-2" /> Pin to top</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmId(s.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Chat;
