"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";

type RunConfig = {
  phone: string;
  description: string;
  websiteUrl: string;
  numAgents: number;
  tasks: string[];
};

type AggregateIssue = {
  severity: "high" | "medium" | "low";
  theme: string;
  title: string;
  description: string;
  call_count?: number;
  evidence?: string;
};

type AggregateReport = {
  executive_summary: string;
  issues: AggregateIssue[];
  recommendations: string[];
  themes: string[];
  unique_issue_themes: number;
};

type AggregateMetrics = {
  total_calls: number;
  task_completion_rate: number;
  completed_calls: number;
  calls_with_high_severity: number;
  calls_with_high_severity_pct: number;
  issue_density: number;
  short_call_rate: number;
  short_calls: number;
  long_call_rate: number;
  long_calls: number;
  severity_distribution: {
    high: number;
    medium: number;
    low: number;
    high_pct: number;
    medium_pct: number;
    low_pct: number;
  };
  tasks_with_zero_issues: number;
  total_issues: number;
  total_duration_seconds: number;
  average_duration_seconds: number;
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
    analysis_id?: string;
    analysis_pending?: boolean;
    analysis_report?: {
      model?: string;
      confidence?: string;
      task_outcome?: string;
      edge_cases?: string[];
      recommendations?: string[];
    };
    transcript_excerpt?: string[];
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

type Severity = "high" | "medium" | "low" | "unknown";

function parseSeverity(issueText: string): Severity {
  const match = issueText.match(/^\[(high|medium|low)\]/i);
  if (!match) return "unknown";
  return match[1].toLowerCase() as Severity;
}

function getAgentDuration(r: AgentCardState): number {
  let v = Number(r.result?.duration_seconds);
  if (Number.isNaN(v) || v < 0) v = Number(r.result?.elapsed_wait_seconds);
  return Number.isNaN(v) || v < 0 ? 0 : v;
}

async function pollAnalysis(analysisId: string, timeoutMs = 120000): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(apiUrl(`/api/call/batch/one/analysis?id=${analysisId}`), { credentials: "include" });
      const data = await res.json();
      if (data?.ready) return data.result;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
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

function mergeAgentResults(
  agents: AgentCardState[],
  index: number,
  updates: Partial<AgentCardState>
) {
  return agents.map((agent) => (agent.index === index ? { ...agent, ...updates } : agent));
}

function mergeAgentResultPayload(
  agents: AgentCardState[],
  index: number,
  resultUpdates: Partial<NonNullable<AgentCardState["result"]>>,
  stateOverride?: AgentCardState["state"]
) {
  return agents.map((agent) =>
    agent.index === index
      ? {
          ...agent,
          ...(stateOverride ? { state: stateOverride } : {}),
          result: { ...agent.result, ...resultUpdates },
        }
      : agent
  );
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

async function getJson(path: string, signal?: AbortSignal) {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
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
  onProgress,
  onDone,
  onCancel,
}: {
  cfg: RunConfig;
  onProgress: (results: AgentCardState[]) => void;
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
  const onProgressRef = useRef(onProgress);
  const onDoneRef = useRef(onDone);
  onProgressRef.current = onProgress;
  onDoneRef.current = onDone;

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
    onProgressRef.current(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    cancelledRef.current = false;
    let currentAgents = initialAgents.map((agent) => ({ ...agent }));
    const publishAgents = (nextAgents: AgentCardState[]) => {
      currentAgents = nextAgents;
      setAgents(nextAgents);
      onProgressRef.current(nextAgents);
    };

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
        publishAgents(
          mergeAgentResults(currentAgents, idx, { state: "calling", startedAtMs: Date.now() })
        );

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
          publishAgents(
            mergeAgentResults(currentAgents, idx, {
              state: result.status === "failed" ? "failed" : "done",
              finishedAtMs: Date.now(),
              result,
            })
          );
        } catch (err) {
          if (isAbortError(err) || cancelledRef.current) return;
          if (skipRef.current) {
            skipRef.current = false;
            publishAgents(
              mergeAgentResults(currentAgents, idx, {
                state: "done",
                finishedAtMs: Date.now(),
                result: { status: "skipped", result_summary: "Skipped by user." },
              })
            );
            continue;
          }
          const msg = err instanceof Error ? err.message : "Call failed.";
          publishAgents(
            mergeAgentResults(currentAgents, idx, {
              state: "failed",
              finishedAtMs: Date.now(),
              result: { error: msg, status: "failed" },
            })
          );
        }
      }

      if (!cancelledRef.current) {
        setRunning(false);
        setStatusText("Run complete.");
        if (!stoppedRef.current) {
          stoppedRef.current = true;
          onDoneRef.current(currentAgents);
        }
      }
    }

    run();
    return () => {
      cancelledRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, [cfg.description, cfg.numAgents, cfg.phone, cfg.tasks, cfg.websiteUrl, initialAgents]);

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
    () => agents.reduce((sum, a) => sum + getAgentDuration(a), 0),
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
              {agent.result?.analysis_pending ? (
                <p className="text-xs text-[var(--calpen-amber)] mb-2">Post-call analysis pending...</p>
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

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "green" | "amber" | "red" | "neutral";
}) {
  const valueColor =
    color === "green"
      ? "text-[var(--calpen-green)]"
      : color === "amber"
        ? "text-[var(--calpen-amber)]"
        : color === "red"
          ? "text-[var(--calpen-red)]"
          : "text-white";
  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 px-4 py-4">
      <p className="font-serif text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`font-serif text-2xl font-light ${valueColor}`}>{value}</p>
      {sub && <p className="font-serif text-xs text-gray-600 mt-0.5">{sub}</p>}
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
  const [aggregateReport, setAggregateReport] = useState<AggregateReport | null>(null);
  const [aggMetrics, setAggMetrics] = useState<AggregateMetrics | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const fetchReport = async () => {
      try {
        const payload = results.map((agent) => ({
          task: agent.task,
          status: agent.result?.wait_status || agent.result?.status,
          duration_seconds: agent.result?.duration_seconds,
          elapsed_wait_seconds: agent.result?.elapsed_wait_seconds,
          issues_detected: agent.result?.issues_detected || [],
          transcript_excerpt: agent.result?.transcript_excerpt || [],
          analysis_report: agent.result?.analysis_report,
          result_summary: agent.result?.result_summary,
        }));
        const data = await postJson("/api/report/aggregate", {
          results: payload,
          description: cfg.description,
        });
        if (cancelled) return;
        setAggregateReport(data.report);
        setAggMetrics(data.metrics);
      } catch (err) {
        if (!cancelled) setReportError(err instanceof Error ? err.message : "Failed to generate report.");
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    fetchReport();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const issuesByTheme = useMemo(() => {
    if (!aggregateReport) return {} as Record<string, AggregateIssue[]>;
    const grouped: Record<string, AggregateIssue[]> = {};
    for (const issue of aggregateReport.issues) {
      const theme = issue.theme || "General";
      if (!grouped[theme]) grouped[theme] = [];
      grouped[theme].push(issue);
    }
    return grouped;
  }, [aggregateReport]);

  const orderedThemes = useMemo(() => {
    if (!aggregateReport) return [];
    const withIssues = aggregateReport.themes.filter((t) => issuesByTheme[t]);
    return withIssues.length > 0 ? withIssues : Object.keys(issuesByTheme);
  }, [aggregateReport, issuesByTheme]);

  return (
    <div className="relative min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#13110e]/60 via-[#13110e]/40 to-[#13110e]" />
      <div className="py-9 px-6 md:px-11 max-w-5xl mx-auto relative z-10 text-white">

        {/* Header */}
        <div className="pb-7 mb-8 border-b border-gray-700">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-tight">Penetration test report</h2>
          <p className="text-gray-400 text-base mt-2 font-serif">
            {cfg.phone} · {cfg.description}
            <br />
            {new Date().toLocaleString()} · {cfg.numAgents} agents · {cfg.tasks.join(", ")}
          </p>
        </div>

        {/* Metrics grid — shown immediately from backend once available */}
        {aggMetrics && (
          <div className="mb-8">
            <h3 className="font-serif text-xs uppercase tracking-wider text-gray-500 mb-3">Key metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <MetricCard
                label="Task completion"
                value={`${aggMetrics.task_completion_rate}%`}
                sub={`${aggMetrics.completed_calls} / ${aggMetrics.total_calls} calls`}
                color={aggMetrics.task_completion_rate >= 80 ? "green" : aggMetrics.task_completion_rate >= 50 ? "amber" : "red"}
              />
              <MetricCard
                label="High-severity calls"
                value={String(aggMetrics.calls_with_high_severity)}
                sub={`${aggMetrics.calls_with_high_severity_pct}% of calls`}
                color={aggMetrics.calls_with_high_severity === 0 ? "green" : "red"}
              />
              <MetricCard
                label="Issue density"
                value={`${aggMetrics.issue_density}`}
                sub="issues / min of talk"
                color={aggMetrics.issue_density < 1 ? "green" : aggMetrics.issue_density < 3 ? "amber" : "red"}
              />
              <MetricCard
                label="Avg call duration"
                value={formatSeconds(aggMetrics.average_duration_seconds)}
                sub={`${formatSeconds(aggMetrics.total_duration_seconds)} total`}
                color="neutral"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                label="Short calls (<15s)"
                value={`${aggMetrics.short_call_rate}%`}
                sub={`${aggMetrics.short_calls} calls — possible dead-ends`}
                color={aggMetrics.short_call_rate < 10 ? "green" : aggMetrics.short_call_rate < 30 ? "amber" : "red"}
              />
              <MetricCard
                label="Long calls (>3 min)"
                value={`${aggMetrics.long_call_rate}%`}
                sub={`${aggMetrics.long_calls} calls — possible loops`}
                color={aggMetrics.long_call_rate < 10 ? "green" : "amber"}
              />
              <MetricCard
                label="Zero-issue tasks"
                value={String(aggMetrics.tasks_with_zero_issues)}
                sub={`of ${aggMetrics.total_calls} calls passed cleanly`}
                color={aggMetrics.tasks_with_zero_issues > 0 ? "green" : "amber"}
              />
              <MetricCard
                label="Severity split"
                value={`${aggMetrics.severity_distribution.high}H · ${aggMetrics.severity_distribution.medium}M · ${aggMetrics.severity_distribution.low}L`}
                sub={`${aggMetrics.total_issues} total issues`}
                color={aggMetrics.severity_distribution.high === 0 ? "green" : "red"}
              />
            </div>
          </div>
        )}

        {/* Consolidated report — loading / error states */}
        {reportLoading && (
          <div className="mb-8 p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 text-center">
            <p className="font-serif text-gray-400 animate-pulse">Generating consolidated report…</p>
          </div>
        )}
        {reportError && !reportLoading && (
          <div className="mb-6 p-4 bg-red-900/20 rounded-xl border border-red-800/40">
            <p className="font-serif text-sm text-red-400">{reportError}</p>
          </div>
        )}

        {aggregateReport && (
          <>
            {/* Executive summary */}
            <div className="mb-8 p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700">
              <h3 className="font-serif text-xs uppercase tracking-wider text-gray-500 mb-3">Executive summary</h3>
              <p className="font-serif text-base text-gray-200 leading-relaxed">
                {aggregateReport.executive_summary}
              </p>
            </div>

            {/* Issues grouped by theme */}
            {aggregateReport.issues.length > 0 && (
              <div className="mb-8">
                <h3 className="font-serif text-xs uppercase tracking-wider text-gray-500 mb-3">
                  Findings · {aggregateReport.issues.length} issue{aggregateReport.issues.length !== 1 ? "s" : ""} across {orderedThemes.length} theme{orderedThemes.length !== 1 ? "s" : ""}
                </h3>
                <div className="space-y-4">
                  {orderedThemes.map((theme) => {
                    const themeIssues = issuesByTheme[theme] || [];
                    if (!themeIssues.length) return null;
                    const highCount = themeIssues.filter((i) => i.severity === "high").length;
                    return (
                      <div key={theme} className="rounded-xl border border-gray-800 bg-black/40 backdrop-blur-sm overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
                          <h4 className="font-serif text-sm font-semibold text-white">{theme}</h4>
                          <span className="text-xs text-gray-600">{themeIssues.length} issue{themeIssues.length !== 1 ? "s" : ""}</span>
                          {highCount > 0 && (
                            <span className="text-xs text-[var(--calpen-red)] ml-auto">{highCount} high</span>
                          )}
                        </div>
                        <div className="p-4 space-y-3">
                          {themeIssues.map((issue, idx) => {
                            const pillClass =
                              issue.severity === "high"
                                ? "bg-[var(--calpen-red)]/20 text-[var(--calpen-red)] border-[var(--calpen-red)]/40"
                                : issue.severity === "medium"
                                  ? "bg-[var(--calpen-amber)]/20 text-[var(--calpen-amber)] border-[var(--calpen-amber)]/40"
                                  : "bg-gray-500/20 text-gray-400 border-gray-500/40";
                            return (
                              <div key={idx} className="flex items-start gap-3">
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium border ${pillClass} mt-0.5`}>
                                  {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-serif text-sm text-white font-medium">{issue.title}</p>
                                  {issue.description && (
                                    <p className="font-serif text-xs text-gray-400 mt-0.5 leading-relaxed">{issue.description}</p>
                                  )}
                                  {issue.evidence && (
                                    <p className="font-serif text-xs text-gray-500 mt-0.5 italic">"{issue.evidence}"</p>
                                  )}
                                  {(issue.call_count ?? 0) > 1 && (
                                    <p className="font-serif text-xs text-gray-600 mt-0.5">Seen in {issue.call_count} calls</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {aggregateReport.recommendations.length > 0 && (
              <div className="mb-8 p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700">
                <h3 className="font-serif text-xs uppercase tracking-wider text-gray-500 mb-4">Recommendations</h3>
                <ul className="space-y-2">
                  {aggregateReport.recommendations.map((rec, idx) => (
                    <li key={idx} className="font-serif text-sm text-gray-200 flex gap-3 leading-relaxed">
                      <span className="text-gray-600 shrink-0 mt-0.5">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Compact per-call log */}
        <div className="mb-8">
          <h3 className="font-serif text-xs uppercase tracking-wider text-gray-500 mb-3">Call log</h3>
          <div className="rounded-xl border border-gray-800 bg-black/40 backdrop-blur-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="font-serif text-xs uppercase tracking-wider text-gray-600 text-left px-4 py-3">Agent · Task</th>
                  <th className="font-serif text-xs uppercase tracking-wider text-gray-600 text-right px-4 py-3">Duration</th>
                  <th className="font-serif text-xs uppercase tracking-wider text-gray-600 text-right px-4 py-3">Status</th>
                  <th className="font-serif text-xs uppercase tracking-wider text-gray-600 text-right px-4 py-3">Issues</th>
                </tr>
              </thead>
              <tbody>
                {results.map((agent, idx) => {
                  const status = agent.result?.wait_status || agent.result?.status || agent.state;
                  const issues = agent.result?.issues_detected || [];
                  const highCount = issues.filter((i) => parseSeverity(i) === "high").length;
                  const isOk = ["completed", "done", "ended"].includes(status);
                  const isFail = status === "failed" || agent.state === "failed";
                  return (
                    <tr key={agent.index} className={idx < results.length - 1 ? "border-b border-gray-800/50" : ""}>
                      <td className="font-serif px-4 py-3 text-gray-200">
                        <span className="text-gray-600 mr-2">#{agent.index}</span>{agent.task}
                      </td>
                      <td className="font-serif px-4 py-3 text-gray-400 text-right tabular-nums">
                        {formatSeconds(agent.result?.duration_seconds ?? agent.result?.elapsed_wait_seconds)}
                      </td>
                      <td className="font-serif px-4 py-3 text-right">
                        <span className={`text-xs ${isOk ? "text-[var(--calpen-green)]" : isFail ? "text-[var(--calpen-red)]" : "text-gray-500"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="font-serif px-4 py-3 text-right">
                        {issues.length === 0 ? (
                          <span className="text-xs text-gray-700">—</span>
                        ) : (
                          <span className={`text-xs ${highCount > 0 ? "text-[var(--calpen-red)]" : "text-[var(--calpen-amber)]"}`}>
                            {issues.length}{highCount > 0 ? ` (${highCount}H)` : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
  const activeAnalysisPollsRef = useRef<Set<string>>(new Set());
  const analysisIdToIndexRef = useRef<Map<string, number>>(new Map());
  const pollingUnmountedRef = useRef(false);

  useEffect(() => {
    return () => {
      pollingUnmountedRef.current = true;
    };
  }, []);

  // Merge incoming live-call state without overwriting already-completed analysis fields.
  const handleProgress = useCallback((liveAgents: AgentCardState[]) => {
    setResults((prev) => {
      const indexed = new Map(prev.map((a) => [a.index, a]));
      return liveAgents.map((liveAgent) => {
        const existing = indexed.get(liveAgent.index);
        if (!existing || existing.result?.analysis_pending !== false) {
          return liveAgent;
        }
        // Analysis already completed — preserve its fields so they aren't overwritten.
        return {
          ...liveAgent,
          result: {
            ...liveAgent.result,
            analysis_pending: false,
            result_summary: existing.result.result_summary,
            issues_detected: existing.result.issues_detected,
            analysis_report: existing.result.analysis_report,
            transcript_excerpt: existing.result.transcript_excerpt,
            analysis_error: existing.result.analysis_error,
          },
        };
      });
    });
  }, []);

  useEffect(() => {
    results.forEach((agent) => {
      const analysisId = agent.result?.analysis_id;
      if (!analysisId || !agent.result?.analysis_pending || activeAnalysisPollsRef.current.has(analysisId)) {
        return;
      }

      const agentIndex = agent.index;
      activeAnalysisPollsRef.current.add(analysisId);
      analysisIdToIndexRef.current.set(analysisId, agentIndex);

      pollAnalysis(analysisId, 240000)
        .then((analysisResult) => {
          if (pollingUnmountedRef.current) return;
          const index = analysisIdToIndexRef.current.get(analysisId);
          analysisIdToIndexRef.current.delete(analysisId);
          if (index === undefined) return;

          if (!analysisResult) {
            setResults((prev) =>
              mergeAgentResultPayload(prev, index, {
                analysis_pending: false,
                analysis_error:
                  prev.find((item) => item.index === index)?.result?.analysis_error ||
                  "Timed out waiting for post-call analysis.",
              })
            );
            return;
          }

          setResults((prev) => {
            const existing = prev.find((a) => a.index === index)?.result;
            const fromAnalysis = analysisResult as Partial<NonNullable<AgentCardState["result"]>>;
            const validDuration =
              fromAnalysis.duration_seconds != null && Number(fromAnalysis.duration_seconds) > 0
                ? Number(fromAnalysis.duration_seconds)
                : undefined;
            const validElapsed =
              fromAnalysis.elapsed_wait_seconds != null && Number(fromAnalysis.elapsed_wait_seconds) >= 0
                ? Number(fromAnalysis.elapsed_wait_seconds)
                : undefined;
            const updates: Partial<NonNullable<AgentCardState["result"]>> = {
              ...fromAnalysis,
              analysis_pending: false,
              duration_seconds: validDuration ?? existing?.duration_seconds ?? undefined,
              elapsed_wait_seconds: validElapsed ?? existing?.elapsed_wait_seconds ?? undefined,
            };
            return mergeAgentResultPayload(prev, index, updates);
          });
        })
        .finally(() => {
          activeAnalysisPollsRef.current.delete(analysisId);
        });
    });
  }, [results]);

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
            onProgress={handleProgress}
            onDone={(nextResults) => {
              handleProgress(nextResults);
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
