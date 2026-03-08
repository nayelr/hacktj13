"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";

type RunConfig = {
  phone: string;
  description: string;
  websiteUrl: string;
  numAgents: number;
  tasks: string[];
};

type AgentCardState = {
  index: number;
  task: string;
  state: "queued" | "calling" | "done" | "failed";
  startedAtMs?: number;
  finishedAtMs?: number;
  result?: {
    status?: string;
    wait_status?: string;
    duration_seconds?: number | null;
    elapsed_wait_seconds?: number | null;
    result_summary?: string;
    issues_detected?: string[];
    call_sid?: string;
    analysis_report?: {
      model?: string;
      confidence?: string;
      task_outcome?: string;
      edge_cases?: string[];
      recommendations?: string[];
    };
    analysis_error?: string;
    error?: string;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";
const MIN_AGENTS = 2;
const MAX_AGENTS = 10;

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

function formatSeconds(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "n/a";
  return `${Number(value).toFixed(1)}s`;
}

function parseTasks(raw: string) {
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^[\-\*\d\.\)\s]+/, "").trim())
    .filter(Boolean);
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /abort|signal is aborted/i.test(msg);
}

function createRunId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function postJson(path: string, body: unknown, signal?: AbortSignal) {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || res.statusText || "Request failed.");
  }
  return data;
}

function InputPage({
  onStart,
}: {
  onStart: (cfg: RunConfig) => void;
}) {
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [numAgents, setNumAgents] = useState(3);
  const [tasksRaw, setTasksRaw] = useState("- book appointment\n- cancel appointment\n- check status");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);

  const onSuggest = async () => {
    setError("");
    setStatus("");
    const summary = description.trim();
    if (!summary) {
      setError("Business summary is required to suggest tasks.");
      return;
    }
    setSuggestLoading(true);
    try {
      const data = await postJson("/api/tasks/suggest", { description: summary });
      const tasks = (data?.tasks || []) as string[];
      if (!tasks.length) {
        setStatus("No suggested tasks returned.");
      } else {
        setTasksRaw(tasks.map((task) => `- ${task}`).join("\n"));
        setStatus("Suggested tasks generated.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest tasks.");
    } finally {
      setSuggestLoading(false);
    }
  };

  const launch = () => {
    setError("");
    setStatus("");
    const parsedTasks = parseTasks(tasksRaw);
    if (!description.trim()) {
      setError("Business summary is required.");
      return;
    }
    if (!phone.trim()) {
      setError("US phone number is required.");
      return;
    }
    if (numAgents < MIN_AGENTS || numAgents > MAX_AGENTS) {
      setError(`Agent count must be between ${MIN_AGENTS} and ${MAX_AGENTS}.`);
      return;
    }
    if (!parsedTasks.length) {
      setError("Task list is required (at least one task).");
      return;
    }
    onStart({
      phone: phone.trim(),
      description: description.trim(),
      websiteUrl: websiteUrl.trim(),
      numAgents,
      tasks: parsedTasks,
    });
  };

  return (
    <section className="relative min-h-screen flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#13110e]/60 via-[#13110e]/40 to-[#13110e]" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-32 pb-16">
        <div className="inline-flex items-center gap-2 glass-nav rounded-full px-4 py-2 text-sm text-gray-300 mb-8 animate-fade-in-up">
          <span className="w-2 h-2 bg-green-500 rounded-full pulse-indicator" />
          <span className="tracking-wider uppercase text-xs">IVR penetration testing</span>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl leading-tight animate-fade-in-up animate-delay-100">
          Find where your
          <br />
          phone system fails.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl mt-6 max-w-xl animate-fade-in-up animate-delay-200">
          Automated IVR audits, real outbound calls, and edge-case analysis.
        </p>

        <div className="mt-8 w-full max-w-2xl animate-fade-in-up animate-delay-300">
          <div className="glass-nav rounded-2xl p-6 md:p-8 text-left border border-white/10">
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Target US phone number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none mb-4"
            />

            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Business summary (required)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What the business does, key services, common customer requests..."
              className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none resize-y mb-4"
            />

            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Business website (optional)</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none mb-4"
            />

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Agents (2-10)</label>
                <input
                  type="number"
                  min={MIN_AGENTS}
                  max={MAX_AGENTS}
                  value={numAgents}
                  onChange={(e) => setNumAgents(Number(e.target.value || 0))}
                  className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                />
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={onSuggest}
                  disabled={suggestLoading}
                  className="w-full md:w-auto border border-gray-600 text-white rounded-full px-5 py-3 text-sm font-medium hover:bg-white/5 transition-colors disabled:opacity-60"
                >
                  {suggestLoading ? "Generating..." : "Suggest tasks from summary"}
                </button>
              </div>
            </div>

            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Task list (one per line)</label>
            <textarea
              value={tasksRaw}
              onChange={(e) => setTasksRaw(e.target.value)}
              rows={6}
              placeholder="- book appointment&#10;- cancel appointment&#10;- check status"
              className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none resize-y mb-6"
            />

            <button
              onClick={launch}
              className="w-full bg-white text-black font-medium px-6 py-3 rounded-full hover:bg-gray-100 transition-colors"
            >
              Launch penetration test
            </button>

            {status ? <p className="text-green-400 text-sm mt-3">{status}</p> : null}
            {error ? <p className="text-red-400 text-sm mt-3">{error}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function LivePage({
  cfg,
  onDone,
  onCancel,
}: {
  cfg: RunConfig;
  onDone: (results: AgentCardState[]) => void;
  onCancel: () => void;
}) {
  const initialAgents = useMemo<AgentCardState[]>(
    () =>
      Array.from({ length: cfg.numAgents }, (_, i) => ({
        index: i + 1,
        task: cfg.tasks[i % cfg.tasks.length],
        state: "queued",
      })),
    [cfg.numAgents, cfg.tasks]
  );
  const [agents, setAgents] = useState<AgentCardState[]>(initialAgents);
  const [statusText, setStatusText] = useState("Preparing run...");
  const [errorText, setErrorText] = useState("");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [running, setRunning] = useState(true);
  const startedAtRef = useRef<number>(Date.now());
  const stoppedRef = useRef(false);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const skipRef = useRef(false);
  const runIdRef = useRef<string>(createRunId());

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setAgents(initialAgents);
    startedAtRef.current = Date.now();
    setElapsedSec(0);
  }, [initialAgents]);

  useEffect(() => {
    cancelledRef.current = false;
    let currentAgents = initialAgents.map((agent) => ({ ...agent }));

    async function run() {
      try {
        const ac = new AbortController();
        abortControllerRef.current = ac;
        await postJson("/api/context", {
          description: cfg.description,
          website_url: cfg.websiteUrl,
        }, ac.signal);
      } catch (err) {
        if (isAbortError(err) || cancelledRef.current) return;
        setErrorText(err instanceof Error ? err.message : "Failed to save context.");
        setRunning(false);
        return;
      }

      for (let i = 0; i < cfg.numAgents; i += 1) {
        if (cancelledRef.current) return;
        const idx = i + 1;
        const task = cfg.tasks[i % cfg.tasks.length];
        setStatusText(`Running agent ${idx} of ${cfg.numAgents}...`);
        currentAgents = currentAgents.map((agent) =>
          agent.index === idx ? { ...agent, state: "calling", startedAtMs: Date.now() } : agent
        );
        setAgents([...currentAgents]);

        try {
          skipRef.current = false;
          const ac = new AbortController();
          abortControllerRef.current = ac;
          const data = await postJson("/api/call/batch/one", {
            to_number: cfg.phone,
            description: cfg.description,
            website_url: cfg.websiteUrl,
            task,
            run_id: runIdRef.current,
          }, ac.signal);
          if (cancelledRef.current) return;
          const result = data?.result || {};
          currentAgents = currentAgents.map((agent) =>
            agent.index === idx
              ? {
                  ...agent,
                  state: result.status === "failed" ? "failed" : "done",
                  finishedAtMs: Date.now(),
                  result,
                }
              : agent
          );
          setAgents([...currentAgents]);
        } catch (err) {
          if (isAbortError(err) || cancelledRef.current) return;
          if (skipRef.current) {
            skipRef.current = false;
            currentAgents = currentAgents.map((agent) =>
              agent.index === idx
                ? {
                    ...agent,
                    state: "done",
                    finishedAtMs: Date.now(),
                    result: { status: "skipped", result_summary: "Skipped by user." },
                  }
                : agent
            );
            setAgents([...currentAgents]);
            continue;
          }
          const msg = err instanceof Error ? err.message : "Call failed.";
          currentAgents = currentAgents.map((agent) =>
            agent.index === idx
              ? {
                  ...agent,
                  state: "failed",
                  finishedAtMs: Date.now(),
                  result: { error: msg, status: "failed" },
                }
              : agent
          );
          setAgents([...currentAgents]);
        }
      }

      if (!cancelledRef.current) {
        setRunning(false);
        setStatusText("Run complete.");
        if (!stoppedRef.current) {
          stoppedRef.current = true;
          onDone(currentAgents);
        }
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, [cfg.description, cfg.numAgents, cfg.phone, cfg.tasks, cfg.websiteUrl, initialAgents, onDone]);

  const handleSkip = () => {
    skipRef.current = true;
    abortControllerRef.current?.abort();
  };

  const handleCancel = async () => {
    cancelledRef.current = true;
    abortControllerRef.current?.abort();
    setRunning(false);
    setStatusText("Cancelling active calls...");
    try {
      await postJson("/api/call/batch/cancel", {
        run_id: runIdRef.current,
      });
    } catch {
      // Ignore teardown errors here; UI still exits after issuing cancel.
    }
    setStatusText("Cancelled.");
    onCancel();
  };

  const doneCount = useMemo(
    () => agents.filter((a) => a.state === "done" || a.state === "failed").length,
    [agents]
  );
  const progress = Math.round((doneCount / cfg.numAgents) * 100);
  const knownCallDurationTotal = useMemo(
    () =>
      agents.reduce((sum, a) => {
        const value = Number(a.result?.duration_seconds);
        return Number.isNaN(value) || value < 0 ? sum : sum + value;
      }, 0),
    [agents]
  );

  return (
    <div className="py-7 px-6 md:px-9 max-w-6xl mx-auto relative z-10 text-white">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Running penetration test</h2>
          <p className="text-[var(--calpen-muted)] text-sm mt-1">
            {cfg.phone} · {cfg.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {running && (
            <button
              onClick={handleSkip}
              className="border border-[var(--calpen-amber)]/50 text-[var(--calpen-amber)] rounded-full px-4 py-2 text-sm font-medium hover:bg-[var(--calpen-amber)]/10 transition-colors"
            >
              Skip agent →
            </button>
          )}
          {running && (
            <button
              onClick={handleCancel}
              className="border border-[var(--calpen-red)]/50 text-[var(--calpen-red)] rounded-full px-4 py-2 text-sm font-medium hover:bg-[var(--calpen-red)]/10 transition-colors"
            >
              Cancel test
            </button>
          )}
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border ${
              running
                ? "bg-[var(--calpen-green)]/10 border-[var(--calpen-green)]/40 text-[var(--calpen-green)]"
                : "bg-white/5 border-[var(--calpen-border)] text-[var(--calpen-muted)]"
            }`}
          >
            {running && <div className="w-2 h-2 rounded-full bg-[var(--calpen-green)] animate-pulse" />}
            {running ? `LIVE · ${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}` : "COMPLETE"}
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-1.5">
          <span>{statusText}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-[var(--calpen-surface)] rounded-full overflow-hidden border border-[var(--calpen-border)]">
          <div className="h-1 bg-[var(--calpen-muted)] rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const status = agent.result?.wait_status || agent.result?.status || agent.state;
          const issues = agent.result?.issues_detected || [];
          const report = agent.result?.analysis_report;
          return (
            <div key={agent.index} className="bg-[var(--calpen-surface)] rounded-xl border border-[var(--calpen-border)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    agent.state === "calling"
                      ? "bg-[var(--calpen-green)] animate-pulse"
                      : agent.state === "failed"
                        ? "bg-[var(--calpen-red)]"
                        : agent.state === "done"
                          ? "bg-[var(--calpen-blue)]"
                          : "bg-[var(--calpen-label)]"
                  }`}
                />
                <h3 className="text-sm font-semibold text-white">Agent {agent.index}</h3>
                <span className="ml-auto text-xs uppercase tracking-wider text-[var(--calpen-label)]">{status}</span>
              </div>
              <p className="text-sm text-[var(--calpen-muted)] mb-3">{agent.task}</p>
              <div className="space-y-1 text-xs text-[var(--calpen-muted)] font-mono mb-3">
                <p>Call duration: {formatSeconds(agent.result?.duration_seconds ?? agent.result?.elapsed_wait_seconds)}</p>
                <p>Wait elapsed: {formatSeconds(agent.result?.elapsed_wait_seconds)}</p>
                {agent.result?.call_sid ? <p>Call SID: {agent.result.call_sid}</p> : null}
              </div>
              {agent.result?.result_summary ? (
                <p className="text-sm text-white mb-2">
                  <span className="text-[var(--calpen-label)] uppercase text-[10px] tracking-wider mr-2">Summary</span>
                  {agent.result.result_summary}
                </p>
              ) : null}
              {issues.length ? (
                <div className="mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--calpen-label)] mb-1">Issues detected</p>
                  {issues.slice(0, 4).map((issue, idx) => (
                    <p key={`${agent.index}-${idx}`} className="text-xs text-[var(--calpen-red)] mb-1">
                      {issue}
                    </p>
                  ))}
                </div>
              ) : null}
              {report ? (
                <div className="pt-2 border-t border-[var(--calpen-border)] mt-2">
                  <p className="text-xs text-[var(--calpen-muted)]">
                    <span className="uppercase tracking-wider text-[10px] mr-2">AI outcome</span>
                    {report.task_outcome || "unknown"} · {report.confidence || "n/a"} · {report.model || "n/a"}
                  </p>
                </div>
              ) : null}
              {agent.result?.analysis_error ? (
                <p className="text-xs text-[var(--calpen-amber)] mt-2">{agent.result.analysis_error}</p>
              ) : null}
              {agent.result?.error ? <p className="text-xs text-[var(--calpen-red)] mt-2">{agent.result.error}</p> : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-[var(--calpen-surface)] rounded-xl border border-[var(--calpen-border)] p-4 text-sm text-[var(--calpen-muted)]">
        <p>Total batch elapsed: {formatSeconds(elapsedSec)}</p>
        <p>Total known call duration: {formatSeconds(knownCallDurationTotal)}</p>
      </div>

      {errorText ? <p className="text-sm text-[var(--calpen-red)] mt-4">{errorText}</p> : null}
    </div>
  );
}

function ReportPage({
  cfg,
  results,
  onReset,
}: {
  cfg: RunConfig;
  results: AgentCardState[];
  onReset: () => void;
}) {
  const metrics = useMemo(() => {
    const initiated = results.length;
    const totalDuration = results.reduce((sum, r) => {
      let v = Number(r.result?.duration_seconds);
      if (Number.isNaN(v) || v < 0) {
        v = Number(r.result?.elapsed_wait_seconds);
      }
      return Number.isNaN(v) || v < 0 ? sum : sum + v;
    }, 0);
    const averageDuration = initiated > 0 ? totalDuration / initiated : 0;
    const totalIssues = results.reduce((sum, r) => sum + (r.result?.issues_detected?.length || 0), 0);
    return { initiated, totalDuration, averageDuration, totalIssues };
  }, [results]);

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#13110e]/60 via-[#13110e]/40 to-[#13110e]" />
      <div className="py-9 px-6 md:px-11 max-w-5xl mx-auto relative z-10 text-white">
        <div className="pb-7 mb-8 border-b border-gray-700">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-tight">Audit report</h2>
          <p className="text-gray-400 text-base mt-2 font-serif">
            {cfg.phone} · {cfg.description}
            <br />
            {new Date().toLocaleString()} · {cfg.numAgents} agents
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 pl-6 py-4 pr-4">
            <p className="font-serif text-sm uppercase tracking-wider text-gray-500 mb-2">Initiated</p>
            <p className="font-serif text-3xl md:text-4xl font-light text-white">{metrics.initiated}</p>
          </div>
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 pl-6 py-4 pr-4">
            <p className="font-serif text-sm uppercase tracking-wider text-gray-500 mb-2">Total call duration</p>
            <p className="font-serif text-3xl md:text-4xl font-light text-[var(--calpen-green)]">{formatSeconds(metrics.totalDuration)}</p>
          </div>
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 pl-6 py-4 pr-4">
            <p className="font-serif text-sm uppercase tracking-wider text-gray-500 mb-2">Average call duration</p>
            <p className="font-serif text-3xl md:text-4xl font-light text-white">{formatSeconds(metrics.averageDuration)}</p>
          </div>
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 pl-6 py-4 pr-4">
            <p className="font-serif text-sm uppercase tracking-wider text-gray-500 mb-2">Issues detected</p>
            <p className="font-serif text-3xl md:text-4xl font-light text-white">{metrics.totalIssues}</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {results.map((agent) => (
            <div key={`report-${agent.index}`} className="rounded-xl border border-gray-800 bg-black/40 backdrop-blur-sm p-6">
              <p className="font-serif text-lg font-semibold text-white mb-1">
                Agent {agent.index} · {agent.task}
              </p>
              <p className="font-serif text-sm text-gray-400 mb-3">
                {(agent.result?.wait_status || agent.result?.status || "unknown")} · duration {formatSeconds(agent.result?.duration_seconds ?? agent.result?.elapsed_wait_seconds)}
              </p>
              {agent.result?.result_summary ? (
                <p className="font-serif text-base text-gray-300 mb-3 leading-relaxed">{agent.result.result_summary}</p>
              ) : null}
              {(agent.result?.issues_detected || []).slice(0, 3).map((issue, idx) => (
                <p key={`issue-${agent.index}-${idx}`} className="font-serif text-sm text-[var(--calpen-red)] mb-1">
                  {issue}
                </p>
              ))}
            </div>
          ))}
        </div>

        <button
          onClick={onReset}
          className="font-serif border border-gray-700 text-white rounded-full px-6 py-3 text-base font-medium hover:bg-white/5 transition-colors"
        >
          ← Run another test
        </button>
      </div>
    </div>
  );
}

export default function Calpen() {
  const [page, setPage] = useState<"input" | "live" | "report">("input");
  const [cfg, setCfg] = useState<RunConfig | null>(null);
  const [results, setResults] = useState<AgentCardState[]>([]);

  return (
    <div className="min-h-screen bg-[#13110e] text-white">
      <Navbar />
      {page === "input" && (
        <InputPage
          onStart={(nextCfg) => {
            setCfg(nextCfg);
            setResults([]);
            setPage("live");
          }}
        />
      )}
      {page === "live" && cfg ? (
        <div className="pt-24 pb-12">
          <LivePage
            cfg={cfg}
            onDone={(nextResults) => {
              setResults(nextResults);
              setPage("report");
            }}
            onCancel={() => {
              setCfg(null);
              setResults([]);
              setPage("input");
            }}
          />
        </div>
      ) : null}
      {page === "report" && cfg ? (
        <div className="pt-24 pb-16">
          <ReportPage
            cfg={cfg}
            results={results}
            onReset={() => {
              setCfg(null);
              setResults([]);
              setPage("input");
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
