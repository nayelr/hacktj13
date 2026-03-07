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
    const duration = 2000;
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
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">Branches mapped per run</p>
              <AnimatedCounter target={11} />
            </div>
            <div className="border-l border-gray-700 pl-6">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-4">Agents per penetration test</p>
              <AnimatedCounter target={4} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
