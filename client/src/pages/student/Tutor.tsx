import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Send, Sparkles, Trash2, Languages, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Gap, Subject } from "@/lib/types";
import { Card, Button, Select, Badge, SourceBadge } from "@/components/ui";
import { Markdown } from "@/lib/markdown";
import { cn, LANGUAGES } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

type Msg = { role: "user" | "assistant"; content: string; source?: "ai" | "rules" };
const STORE = "edugap:tutor";

function loadHistory(): Msg[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}

export default function Tutor() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>(loadHistory);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState<string | null>(null);
  const [topicId, setTopicId] = useState<string>(params.get("topic") ?? "");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => api<{ preferredLanguage?: string }>("/profile") });
  const status = useQuery({ queryKey: ["tutor-status"], queryFn: () => api<{ mode: "ai" | "offline" }>("/tutor/status") });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: () => api<Subject[]>("/catalog/subjects") });
  const gaps = useQuery({ queryKey: ["student-gaps"], queryFn: () => api<Gap[]>("/student/gaps") });
  const lang = language ?? profile.data?.preferredLanguage ?? "en";

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useMutation({
    mutationFn: (history: Msg[]) =>
      api<{ reply: string; source: "ai" | "rules" }>("/tutor/chat", {
        body: { messages: history.map(({ role, content }) => ({ role, content })), language: lang, topicId: topicId ? Number(topicId) : null },
      }),
    onSuccess: (r) => setMessages((m) => [...m, { role: "assistant", content: r.reply, source: r.source }]),
    onError: (e) => {
      toast.error(errorMessage(e));
      setMessages((m) => m.slice(0, -1)); // drop the unanswered question so it can be re-sent
    },
  });

  function ask(text: string) {
    const t = text.trim();
    if (!t || send.isPending) return;
    const next = [...messages, { role: "user" as const, content: t.slice(0, 2000) }];
    setMessages(next);
    setInput("");
    send.mutate(next);
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const weak = (gaps.data ?? []).filter((g) => g.status !== "strong").slice(0, 3);
  const suggestions = [
    ...weak.map((g) => (g.weakConcepts[0] ? `Explain ${g.weakConcepts[0].concept.toLowerCase()} in ${g.topicName.toLowerCase()} step by step` : `Help me understand ${g.topicName.toLowerCase()}`)),
    "What is the difference between area and perimeter?",
    "How do I change a sentence to passive voice?",
    "Why do plant cells have a cell wall?",
  ].slice(0, 4);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-5rem)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Bot className="h-7 w-7 text-brand-600" /> AI Tutor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ask anything from your subjects. Explanations are pitched at your grade and use what we know about your gaps.{" "}
            {status.data && (status.data.mode === "ai" ? <Badge tone="violet">Live: Claude</Badge> : <Badge tone="amber">Offline mode: lesson library</Badge>)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Languages className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Select value={lang} onChange={(e) => setLanguage(e.target.value)} className="h-9 py-1.5 pl-9 text-sm" aria-label="Reply language">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.native}{l.code !== "en" ? ` (${l.label})` : ""}</option>
              ))}
            </Select>
          </div>
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="h-9 w-auto max-w-[200px] py-1.5 text-sm" aria-label="Focus topic">
            <option value="">Any topic</option>
            {subjects.data?.map((s) => (
              <optgroup key={s.id} label={s.name}>
                {s.topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </Select>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setMessages([])} aria-label="Clear conversation">
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-lg shadow-brand-600/25">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-bold">Hi {user?.name.split(" ")[0]}, what shall we learn?</h2>
              <p className="mt-1 text-sm text-slate-500">Try one of these — the first ones are based on your current gaps.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.role === "user" ? "bg-slate-200 text-slate-600" : "bg-brand-600 text-white")}>
                {m.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[15px]", m.role === "user" ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm border border-slate-200 bg-white text-slate-700")}>
                {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown text={m.content} className="prose-chat" />}
                {m.source && <div className="mt-2"><SourceBadge source={m.source} /></div>}
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white"><Bot className="h-4 w-4" /></div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3.5" aria-label="Tutor is typing">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${d * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={onSubmit} className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
              className="field max-h-40 min-h-11 flex-1 resize-none"
              aria-label="Your question"
            />
            <Button type="submit" size="lg" className="h-11 px-4" disabled={!input.trim()} loading={send.isPending} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
