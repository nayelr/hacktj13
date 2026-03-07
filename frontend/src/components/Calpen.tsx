"use client";

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";

const AGENT_SEQUENCE = [
  {
    id: "AGT-01",
    goal: "Explore appointments branch",
    duration: 3000,
    logs: [
      { t: 300, cls: "info", text: "Dialing target IVR..." },
      { t: 800, cls: "ok", text: "Connected — greeting detected" },
      { t: 1200, cls: "info", text: 'Said "appointments"' },
      { t: 1800, cls: "ok", text: "Entered appointments branch" },
      { t: 2200, cls: "info", text: "Found 3 sub-options" },
      { t: 2800, cls: "ok", text: "Branch mapped — 3 nodes discovered" },
    ],
    nodes: [
      { indent: 0, dot: "blue", label: "Main Menu", meta: "Greeting — 5 options detected" },
      { indent: 1, dot: "yellow", label: "1 — Appointments", meta: "3 sub-branches found" },
      { indent: 2, dot: "green", label: "1.1 Schedule New", meta: "Automated ✓" },
      { indent: 2, dot: "red", label: "1.2 Reschedule", meta: "Human transfer ✗" },
      { indent: 2, dot: "green", label: "1.3 Cancel", meta: "Automated ✓" },
    ],
  },
  {
    id: "AGT-02",
    goal: "Explore billing branch",
    duration: 3200,
    logs: [
      { t: 200, cls: "info", text: "Dialing target IVR..." },
      { t: 700, cls: "ok", text: "Connected" },
      { t: 1100, cls: "info", text: 'Said "billing"' },
      { t: 1600, cls: "ok", text: "Entered billing branch" },
      { t: 2100, cls: "err", text: "Payment node — human transfer detected" },
      { t: 2600, cls: "err", text: "Insurance node — human transfer detected" },
      { t: 3000, cls: "ok", text: "Branch mapped — 3 nodes" },
    ],
    nodes: [
      { indent: 1, dot: "red", label: "2 — Billing", meta: "2 of 3 paths escalate to human" },
      { indent: 2, dot: "green", label: "2.1 Check Balance", meta: "Automated ✓" },
      { indent: 2, dot: "red", label: "2.2 Make Payment", meta: "Human transfer ✗" },
      { indent: 2, dot: "red", label: "2.3 Insurance Verify", meta: "Human transfer ✗" },
    ],
  },
  {
    id: "AGT-03",
    goal: "Explore office hours branch",
    duration: 1800,
    logs: [
      { t: 200, cls: "info", text: "Dialing target IVR..." },
      { t: 600, cls: "ok", text: "Connected" },
      { t: 900, cls: "info", text: 'Said "office hours"' },
      { t: 1300, cls: "ok", text: "Static recording — terminal node" },
      { t: 1600, cls: "ok", text: "Branch complete" },
    ],
    nodes: [
      { indent: 1, dot: "green", label: "3 — Office Hours", meta: "Static recording — no escalation ✓" },
    ],
  },
  {
    id: "AGT-04",
    goal: "Explore account updates branch",
    duration: 2400,
    logs: [
      { t: 200, cls: "info", text: "Dialing target IVR..." },
      { t: 600, cls: "ok", text: "Connected" },
      { t: 1000, cls: "info", text: 'Said "account updates"' },
      { t: 1400, cls: "warn", text: "IVR did not recognize intent" },
      { t: 1800, cls: "err", text: "No path found — complete gap in IVR" },
      { t: 2200, cls: "err", text: "Escalated to human immediately" },
    ],
    nodes: [
      { indent: 1, dot: "red", label: "4 — Account Updates", meta: "No path — complete gap ✗" },
    ],
  },
];

type ReportNode = {
  id: string;
  label: string;
  status: string;
  meta: string;
  depth: number;
  retries: number;
  outcome: string;
  transcript: { role: string; text: string; fail?: boolean }[];
  children?: ReportNode[];
};

const REPORT_TREE: ReportNode[] = [
  {
    id: "main",
    label: "Main Menu",
    status: "info",
    meta: "4 branches discovered",
    depth: 1,
    retries: 0,
    outcome: "Routing node",
    transcript: [
      { role: "ivr", text: "Thank you for calling Smile Dental. How can I help you today?" },
      { role: "agent", text: "Appointments." },
    ],
    children: [
      {
        id: "appt",
        label: "1 — Appointments",
        status: "warn",
        meta: "Partial — 1 of 3 paths escalates",
        depth: 2,
        retries: 0,
        outcome: "Partial automation",
        transcript: [
          { role: "ivr", text: "For appointments: say schedule, reschedule, or cancel." },
          { role: "agent", text: "Reschedule." },
        ],
        children: [
          {
            id: "schedule",
            label: "1.1 Schedule New",
            status: "ok",
            meta: "Fully automated",
            depth: 3,
            retries: 0,
            outcome: "Task completed by IVR",
            transcript: [
              { role: "ivr", text: "What date would you like your appointment?" },
              { role: "agent", text: "January tenth." },
              { role: "ivr", text: "Appointment scheduled for January 10th. Goodbye." },
            ],
          },
          {
            id: "reschedule",
            label: "1.2 Reschedule",
            status: "fail",
            meta: "Human transfer — phrasing failure",
            depth: 3,
            retries: 4,
            outcome: "Escalated to human at depth 3",
            transcript: [
              { role: "ivr", text: "Please say your preferred appointment date." },
              { role: "agent", text: "Next Tuesday the fifteenth." },
              { role: "ivr", text: "I'm sorry, I didn't understand. Please say a date like January first." },
              { role: "agent", text: "January fifteen." },
              { role: "ivr", text: "I'm having trouble understanding. Transferring to a representative.", fail: true },
            ],
          },
          {
            id: "cancel",
            label: "1.3 Cancel",
            status: "ok",
            meta: "Fully automated",
            depth: 3,
            retries: 0,
            outcome: "Task completed by IVR",
            transcript: [
              { role: "ivr", text: "Please say your name and appointment date to cancel." },
              { role: "agent", text: "John Smith, January tenth." },
              { role: "ivr", text: "Appointment cancelled. Goodbye." },
            ],
          },
        ],
      },
      {
        id: "billing",
        label: "2 — Billing",
        status: "fail",
        meta: "2 of 3 paths escalate",
        depth: 2,
        retries: 0,
        outcome: "Mostly human-dependent",
        transcript: [
          { role: "ivr", text: "For billing: say balance, payment, or insurance." },
          { role: "agent", text: "Payment." },
        ],
        children: [
          {
            id: "balance",
            label: "2.1 Check Balance",
            status: "ok",
            meta: "Automated",
            depth: 3,
            retries: 0,
            outcome: "Balance read aloud by IVR",
            transcript: [
              { role: "ivr", text: "Please say your 6-digit account number." },
              { role: "agent", text: "One two three four five six." },
              { role: "ivr", text: "Your current balance is $240. Goodbye." },
            ],
          },
          {
            id: "payment",
            label: "2.2 Make Payment",
            status: "fail",
            meta: "Human transfer",
            depth: 3,
            retries: 1,
            outcome: "IVR not connected to payment system",
            transcript: [{ role: "ivr", text: "For payment processing please hold for a representative.", fail: true }],
          },
          {
            id: "insurance",
            label: "2.3 Insurance Verify",
            status: "fail",
            meta: "Human transfer",
            depth: 3,
            retries: 0,
            outcome: "No self-service insurance lookup",
            transcript: [{ role: "ivr", text: "Insurance verification requires a specialist. Transferring now.", fail: true }],
          },
        ],
      },
      {
        id: "hours",
        label: "3 — Office Hours",
        status: "ok",
        meta: "Automated — static recording",
        depth: 2,
        retries: 0,
        outcome: "Info delivered, no escalation",
        transcript: [{ role: "ivr", text: "We are open Monday through Friday 8am to 6pm. Goodbye." }],
      },
      {
        id: "account",
        label: "4 — Account Updates",
        status: "fail",
        meta: "No path — complete gap",
        depth: 2,
        retries: 2,
        outcome: "IVR has no account update flow",
        transcript: [
          { role: "ivr", text: "I didn't understand. How can I help you?" },
          { role: "agent", text: "Update my account information." },
          { role: "ivr", text: "I'm sorry, I can't help with that. Transferring to a representative.", fail: true },
        ],
      },
    ],
  },
];

const FRICTION_POINTS = [
  {
    id: "f1",
    rank: "01",
    severity: "high",
    count: 34,
    label: "Reschedule rejects natural date phrasing",
    sub: "Node 1.2 · Depth 3 · 4 retries before escalation",
    nodeId: "reschedule",
    path: ["Main Menu", "Appointments", "1.2 Reschedule", "❌ Human Transfer"],
  },
  {
    id: "f2",
    rank: "02",
    severity: "high",
    count: 28,
    label: "No self-service path for account updates",
    sub: "Node 4 · Complete gap — task not supported",
    nodeId: "account",
    path: ["Main Menu", "4 — Account Updates", "❌ No Path Found"],
  },
  {
    id: "f3",
    rank: "03",
    severity: "high",
    count: 22,
    label: "Insurance verification always routes to human",
    sub: "Node 2.3 · Automatable with basic lookup integration",
    nodeId: "insurance",
    path: ["Main Menu", "Billing", "2.3 Insurance Verify", "❌ Human Transfer"],
  },
  {
    id: "f4",
    rank: "04",
    severity: "medium",
    count: 17,
    label: "Payment requires agent despite online portal",
    sub: "Node 2.2 · IVR not connected to payment system",
    nodeId: "payment",
    path: ["Main Menu", "Billing", "2.2 Make Payment", "❌ Human Transfer"],
  },
];

const TOP_LEVEL_METRICS = {
  humanNecessityScore: 67,
  automationRate: 33,
  branchesMapped: 11,
  deadEndsFound: 4,
};

const C = {
  bg: "#13110e",
  surface: "#1a1815",
  card: "#1a1815",
  border: "#27272a",
  accent: "#60a5fa",
  accent2: "#60a5fa",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  text: "#fafafa",
  sub: "#a1a1aa",
};
const dotColor = (d: string) =>
  ({ green: C.green, red: C.red, yellow: C.yellow, blue: C.accent2 }[d] || C.sub);

function Label({ text }: { text: string }) {
  return (
    <div className="text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-3">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { bg: string; c: string; t: string }> = {
    ok: { bg: "#10b98118", c: C.green, t: "Automated" },
    warn: { bg: "#f59e0b18", c: C.yellow, t: "Partial" },
    fail: { bg: "#f43f5e18", c: C.red, t: "Escalated" },
    info: { bg: "#4f46e518", c: C.accent2, t: "Routing" },
  };
  const s = m[status] ?? m.info;
  return (
    <span
      style={{
        background: s.bg,
        color: s.c,
        border: `1px solid ${s.c}40`,
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {s.t}
    </span>
  );
}

function Transcript({ transcript }: { transcript: { role: string; text: string; fail?: boolean }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {transcript.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 10,
            flexDirection: l.role === "agent" ? "row-reverse" : "row",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              color: C.sub,
              minWidth: 36,
              paddingTop: 6,
              textAlign: l.role === "agent" ? "right" : "left",
              letterSpacing: 1,
            }}
          >
            {l.role === "agent" ? "AGENT" : "IVR"}
          </span>
          <div
            style={{
              background: l.fail ? "#f43f5e12" : l.role === "agent" ? "#4f46e518" : C.surface,
              border: `1px solid ${l.fail ? "#f43f5e40" : l.role === "agent" ? "#4f46e540" : "transparent"}`,
              color: l.fail ? C.red : l.role === "agent" ? C.accent2 : C.text,
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              maxWidth: "75%",
            }}
          >
            {l.text}
          </div>
        </div>
      ))}
    </div>
  );
}

function TreeNode({
  node,
  depth = 0,
}: {
  node: ReportNode;
  depth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const color = dotColor(node.status === "ok" ? "green" : node.status === "fail" ? "red" : node.status === "warn" ? "yellow" : "blue");
  const hasChildren = (node.children?.length ?? 0) > 0;
  const summary = `Depth ${node.depth} · ${node.retries} retries · ${node.outcome}`;
  return (
    <div style={{ marginLeft: depth * 16 }} className="mb-1">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-[var(--calpen-border)]"
        style={{
          background: open ? "rgba(255,255,255,0.04)" : "transparent",
          borderColor: open ? "var(--calpen-border)" : undefined,
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
          style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--calpen-text)]">{node.label}</span>
            <StatusBadge status={node.status} />
            <span className="text-[var(--calpen-label)] text-xs ml-auto">{open ? "▲" : "▼"}</span>
          </div>
          <p className="text-xs text-[var(--calpen-muted)] mt-0.5">{node.meta}</p>
        </div>
      </div>
      {open && (
        <div className="ml-4 pl-4 border-l border-[var(--calpen-border)] mt-1 mb-3">
          <p className="text-xs text-[var(--calpen-muted)] mb-3">{summary}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowTranscript(!showTranscript); }}
            className="text-xs font-medium text-[var(--calpen-blue)] hover:underline mb-2"
          >
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
          {showTranscript && (
            <div className="bg-[var(--calpen-surface)] rounded-lg p-3 border border-[var(--calpen-border)]">
              <Transcript transcript={node.transcript} />
            </div>
          )}
          {hasChildren && node.children?.map((c) => <TreeNode key={c.id} node={c} depth={0} />)}
        </div>
      )}
    </div>
  );
}

function findNode(
  nodes: ReportNode[],
  id: string
): ReportNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

function FrictionItem({
  item,
}: {
  item: (typeof FRICTION_POINTS)[0];
}) {
  const [open, setOpen] = useState(false);
  const color = item.severity === "high" ? C.red : C.yellow;
  const node = findNode(REPORT_TREE, item.nodeId);
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${open ? `${color}40` : C.border}`,
        borderRadius: 10,
        overflow: "hidden",
        transition: "border-color 0.2s",
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", cursor: "pointer" }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 20, color: C.border, minWidth: 28, fontWeight: 800 }}>{item.rank}</div>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>{item.label}</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: C.sub, marginTop: 3 }}>{item.sub}</div>
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 24, color, fontWeight: 800, minWidth: 36, textAlign: "right" }}>
          {item.count}
        </div>
        <div style={{ fontSize: 11, color: C.sub, marginLeft: 8 }}>{open ? "▲" : "▼"}</div>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 20px", background: C.surface }}>
          <Label text="CALL PATH" />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {item.path.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    background: step.includes("❌") ? "#f43f5e18" : C.border,
                    color: step.includes("❌") ? C.red : C.sub,
                    border: `1px solid ${step.includes("❌") ? "#f43f5e40" : "transparent"}`,
                    padding: "3px 10px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {step}
                </span>
                {i < item.path.length - 1 && <span style={{ color: C.border, fontSize: 10 }}>→</span>}
              </div>
            ))}
          </div>
          {node && (
            <>
              <Label text="TRANSCRIPT" />
              <Transcript transcript={node.transcript} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LivePage({ phone, desc, onDone }: { phone: string; desc: string; onDone: () => void }) {
  const [agentStatuses, setAgentStatuses] = useState<("waiting" | "active" | "done")[]>(
    AGENT_SEQUENCE.map(() => "waiting")
  );
  const [logs, setLogs] = useState<{ cls?: string; text: string; ts?: string }[]>([]);
  const [treeNodes, setTreeNodes] = useState<{ indent: number; dot: string; label: string; meta: string }[]>([]);
  const [callActive, setCallActive] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [, setCurrentIdx] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    runAgent(0);
  }, []);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  function runAgent(idx: number) {
    if (idx >= AGENT_SEQUENCE.length) {
      setTimeout(onDone, 700);
      return;
    }
    const agent = AGENT_SEQUENCE[idx];
    setCurrentIdx(idx);
    setCallActive(true);
    setCallTimer(0);
    setAgentStatuses((prev) => prev.map((s, i) => (i === idx ? "active" : s)));
    setLogs((prev) => [...prev, { cls: "divider", text: `── ${agent.id} · ${agent.goal} ──` }]);
    timerRef.current = setInterval(() => setCallTimer((t) => t + 1), 1000);
    agent.logs.forEach((l) => {
      setTimeout(
        () => setLogs((prev) => [...prev, { ...l, ts: new Date().toTimeString().slice(0, 8) }]),
        l.t
      );
    });
    agent.nodes.forEach((node, ni) => {
      setTimeout(
        () => setTreeNodes((prev) => [...prev, node]),
        agent.duration * 0.25 + ni * 260
      );
    });
    setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallActive(false);
      setAgentStatuses((prev) => prev.map((s, i) => (i === idx ? "done" : s)));
      setTimeout(() => runAgent(idx + 1), 600);
    }, agent.duration);
  }

  const done = agentStatuses.filter((s) => s === "done").length;
  const progress = Math.round((done / AGENT_SEQUENCE.length) * 100);

  return (
    <div className="py-7 px-6 md:px-9 max-w-6xl mx-auto relative z-10 text-white">
      <style>{`@keyframes calpen-fadein{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Scanning IVR</h2>
          <p className="text-[var(--calpen-muted)] text-sm mt-1">{phone} · {desc}</p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border ${
            callActive
              ? "bg-[var(--calpen-green)]/10 border-[var(--calpen-green)]/40 text-[var(--calpen-green)]"
              : "bg-white/5 border-[var(--calpen-border)] text-[var(--calpen-muted)]"
          }`}
        >
          {callActive && <div className="w-2 h-2 rounded-full bg-[var(--calpen-green)] animate-pulse" />}
          {callActive
            ? `CALL ACTIVE · ${String(Math.floor(callTimer / 60)).padStart(2, "0")}:${String(callTimer % 60).padStart(2, "0")}`
            : "BETWEEN CALLS"}
        </div>
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-1.5">
          <span>Overall progress — {done} of {AGENT_SEQUENCE.length} calls complete</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-[var(--calpen-surface)] rounded-full overflow-hidden border border-[var(--calpen-border)]">
          <div
            className="h-1 bg-[var(--calpen-muted)] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {AGENT_SEQUENCE.map((a, i) => {
          const s = agentStatuses[i];
          const isActive = s === "active";
          const isDone = s === "done";
          const isWaiting = s === "waiting";
          const dotClass = isActive ? "bg-[var(--calpen-green)]" : isDone ? "bg-[var(--calpen-muted)]" : "bg-[var(--calpen-label)]";
          return (
            <div
              key={a.id}
              className={`rounded-xl border p-4 transition-all duration-300 ${
                isActive ? "bg-[var(--calpen-surface)] border-[var(--calpen-green)]/40 opacity-100" : "bg-[var(--calpen-surface)]/80 border-[var(--calpen-border)] " + (isWaiting ? "opacity-50" : "opacity-100")
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass} ${isActive ? "animate-pulse" : ""}`} />
                <span className={`text-sm font-semibold ${isActive ? "text-[var(--calpen-green)]" : isDone ? "text-[var(--calpen-muted)]" : "text-[var(--calpen-label)]"}`}>{a.id}</span>
                <span className="ml-auto text-xs uppercase tracking-wider text-[var(--calpen-label)]">
                  {isWaiting ? "Queued" : isActive ? "ON CALL ▶" : "DONE ✓"}
                </span>
              </div>
              <p className="text-[var(--calpen-muted)] text-sm leading-snug">{a.goal}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <div className="bg-[var(--calpen-surface)] rounded-xl border border-[var(--calpen-border)] p-5 overflow-y-auto max-h-[calc(100vh-420px)]">
          <p className="text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-4">IVR Tree — Discovered Nodes</p>
          {treeNodes.length === 0 && (
            <p className="text-[var(--calpen-muted)] text-sm">Waiting for first call to complete...</p>
          )}
          {treeNodes.map((node, i) => (
            <div
              key={`${node.label}-${i}-${node.indent}`}
              className="flex gap-2.5 mb-2.5 animate-[calpen-fadein_0.35s_ease]"
              style={{ marginLeft: node.indent * 20 }}
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                style={{ backgroundColor: dotColor(node.dot), boxShadow: `0 0 8px ${dotColor(node.dot)}80` }}
              />
              <div>
                <p className="text-[var(--calpen-text)] text-sm font-semibold">{node.label}</p>
                <p className="text-[var(--calpen-label)] text-xs mt-0.5">{node.meta}</p>
              </div>
            </div>
          ))}
        </div>
        <div
          ref={logRef}
          className="bg-[var(--calpen-surface)] rounded-xl border border-[var(--calpen-border)] p-5 overflow-y-auto max-h-[calc(100vh-420px)]"
        >
          <p className="text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-4">Call Log</p>
          {logs.map((l, i) =>
            l.cls === "divider" ? (
              <p key={`div-${i}-${l.text}`} className="text-[var(--calpen-muted)] text-xs my-2 font-mono">{l.text}</p>
            ) : (
              <p
                key={`log-${i}-${l.ts ?? 0}-${l.text}`}
                className={`text-xs mb-1 font-mono animate-[calpen-fadein_0.2s_ease] ${
                  l.cls === "ok" ? "text-[var(--calpen-green)]" : l.cls === "err" ? "text-[var(--calpen-red)]" : l.cls === "warn" ? "text-[var(--calpen-amber)]" : "text-[var(--calpen-label)]"
                }`}
              >
                <span className="text-[var(--calpen-label)] opacity-70 mr-2">{l.ts}</span>
                {l.text}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function InputPage({ onStart }: { onStart: (phone: string, desc: string) => void }) {
  const [phone, setPhone] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <section className="relative min-h-screen flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#13110e]/60 via-[#13110e]/40 to-[#13110e]" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-32">
        <div className="inline-flex items-center gap-2 glass-nav rounded-full px-4 py-2 text-sm text-gray-300 mb-8 animate-fade-in-up">
          <span className="w-2 h-2 bg-green-500 rounded-full pulse-indicator" />
          <span className="tracking-wider uppercase text-xs">IVR penetration testing</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="ml-1">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl leading-tight animate-fade-in-up animate-delay-100">
          Find where your
          <br />
          phone system fails.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl mt-6 max-w-xl animate-fade-in-up animate-delay-200">
          Automated IVR audits—AI agents call every branch and map friction points.
        </p>
        <div className="mt-8 w-full max-w-md animate-fade-in-up animate-delay-300">
          <div className="glass-nav rounded-2xl p-6 md:p-8 text-left border border-white/10">
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Target phone number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (800) 555-0100"
              className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none mb-4"
            />
            <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Company description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="e.g. dental office in Virginia"
              className="w-full bg-[#13110e]/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-gray-500 focus:outline-none resize-none mb-6"
            />
            <button
              onClick={() => onStart(phone || "+1 (800) 555-0100", desc || "dental office in Virginia")}
              className="w-full bg-white text-black font-medium px-6 py-3 rounded-full hover:bg-gray-100 transition-colors"
            >
              Launch penetration test
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportPage({ phone, desc, onReset }: { phone: string; desc: string; onReset: () => void }) {
  const metrics = [
    { label: "Human Necessity Score", value: `${TOP_LEVEL_METRICS.humanNecessityScore}%`, color: "var(--calpen-red)", desc: "of tasks require a human" },
    { label: "Automation Rate", value: `${TOP_LEVEL_METRICS.automationRate}%`, color: "var(--calpen-green)", desc: "fully resolved by IVR" },
    { label: "Branches Mapped", value: String(TOP_LEVEL_METRICS.branchesMapped), color: "var(--calpen-text)", desc: "nodes discovered" },
    { label: "Dead Ends Found", value: String(TOP_LEVEL_METRICS.deadEndsFound), color: "var(--calpen-red)", desc: "paths with no resolution" },
  ];
  return (
    <div className="py-9 px-6 md:px-11 max-w-5xl mx-auto relative z-10 text-white">
      <div className="pb-7 mb-8 border-b border-[var(--calpen-border)]">
        <h2 className="text-2xl md:text-3xl font-bold text-[var(--calpen-text)] tracking-tight">Audit report</h2>
        <p className="text-[var(--calpen-muted)] text-sm mt-2 font-mono">
          {phone} · {desc}
          <br />
          {new Date().toLocaleString()} · 4 agents · {TOP_LEVEL_METRICS.branchesMapped} nodes
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {metrics.map((k, i) => (
          <div key={i} className="bg-[var(--calpen-surface)] rounded-xl border border-[var(--calpen-border)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-2">{k.label}</p>
            <p className="text-2xl md:text-3xl font-bold leading-none" style={{ color: k.color }}>{k.value}</p>
            <p className="text-[var(--calpen-label)] text-sm mt-1">{k.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-2">IVR tree</p>
      <p className="text-[var(--calpen-muted)] text-sm mb-3">Click a node to see details. Green = automated, red = human transfer, yellow = partial.</p>
      <div className="bg-[var(--calpen-surface)] rounded-xl border border-[var(--calpen-border)] p-4 mb-6">
        {REPORT_TREE.map((n) => (
          <TreeNode key={n.id} node={n} />
        ))}
      </div>
      <p className="text-xs uppercase tracking-wider text-[var(--calpen-label)] mb-3">Top friction points — click to inspect</p>
      <div className="flex flex-col gap-3 mb-8">
        {FRICTION_POINTS.map((f) => (
          <FrictionItem key={f.id} item={f} />
        ))}
      </div>
      <button
        onClick={onReset}
        className="border border-[var(--calpen-border)] text-[var(--calpen-text)] rounded-lg px-6 py-3 text-sm font-semibold hover:bg-white/5 transition-colors"
      >
        ← Run another test
      </button>
    </div>
  );
}

export default function Calpen() {
  const [page, setPage] = useState<"input" | "live" | "report">("input");
  const [phone, setPhone] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="min-h-screen bg-[#13110e] text-white">
      <Navbar />
      {page === "input" && <InputPage onStart={(p, d) => { setPhone(p); setDesc(d); setPage("live"); }} />}
      {page === "live" && (
        <div className="pt-24 pb-12">
          <LivePage key={phone} phone={phone} desc={desc} onDone={() => setPage("report")} />
        </div>
      )}
      {page === "report" && (
        <div className="pt-24 pb-16">
          <ReportPage phone={phone} desc={desc} onReset={() => setPage("input")} />
        </div>
      )}
    </div>
  );
}
