"use client";

import { useEffect, useState, useRef } from "react";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const duration = 3200;
    const steps = 60;
    const stepValue = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += stepValue;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isVisible, target]);

  return (
    <div ref={ref} className="text-5xl md:text-6xl font-light text-white">
      {count}{suffix}
    </div>
  );
}

const TYPEWRITER_TEXT = "you decide…";
const DELAY_AFTER_65_PERCENT_MS = 3200;

function AgentsCountWithTypewriter() {
  const [count, setCount] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"count" | "type">("count");
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || started) return;
    const t = setTimeout(() => setStarted(true), DELAY_AFTER_65_PERCENT_MS);
    return () => clearTimeout(t);
  }, [isVisible, started]);

  useEffect(() => {
    if (!started) return;
    if (phase === "count") {
      const target = 50;
      const delayFor = (step: number) => (step >= 30 ? 28 : Math.max(28, 160 - step * 4));
      let step = 1;
      let timeoutId: ReturnType<typeof setTimeout>;
      const run = () => {
        setCount(step);
        if (step >= target) {
          timeoutId = setTimeout(() => setPhase("type"), 60);
          return;
        }
        timeoutId = setTimeout(run, delayFor(step));
        step += 1;
      };
      run();
      return () => clearTimeout(timeoutId);
    }
    if (phase === "type" && typed.length < TYPEWRITER_TEXT.length) {
      const baseMs = 130;
      const minMs = 52;
      const speedUp = (i: number) => Math.max(minMs, baseMs - i * 5);
      const i = typed.length;
      const timeout = setTimeout(() => {
        setTyped(TYPEWRITER_TEXT.slice(0, i + 1));
      }, speedUp(i));
      return () => clearTimeout(timeout);
    }
  }, [started, phase, typed]);

  return (
    <div ref={ref} className="text-5xl md:text-6xl font-light text-white">
      {phase === "count" && count > 0 && <span>{count}</span>}
      {typed && <span className="text-white">{phase === "type" ? typed : ` ${typed}`}</span>}
    </div>
  );
}

export function Stats() {
  return (
    <section id="stats" className="bg-[#13110e] py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 items-start">
          <div className="md:col-span-1">
            <p className="text-gray-400 text-lg leading-relaxed">
              One phone number. Calpen runs sequential AI agents that map every IVR branch and surface where automation fails.
            </p>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-8">
            <div className="border-l border-gray-700 pl-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">Calls that reach humans</p>
              <AnimatedCounter target={65} suffix="%" />
            </div>
            <div className="border-l border-gray-700 pl-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">Agents per penetration test</p>
              <AgentsCountWithTypewriter />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
