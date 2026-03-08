"use client";

import { Phone, FileText, Shield } from "lucide-react";

const features = [
  { icon: Phone, title: "One number, one line", description: "You give Calpen one phone number and a one-line description of your company. That's the only input." },
  { icon: FileText, title: "AI voice agents call", description: "Agents call like real customers, explore each branch, and document what options exist and whether the task completes without a human." },
  { icon: Shield, title: "Zero internal access", description: "We audit your entire phone system from the outside. No code, no backend, no VPN—just the number callers use." },
];

export function CustomAgents() {
  return (
    <section id="how-it-works" className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-[minmax(0,280px)_1fr] lg:grid-cols-[minmax(0,320px)_1fr] gap-12 items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-xs uppercase tracking-wider text-gray-500">How It Works</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight">
              From one number
              <br />
              to a full audit
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="feature-card rounded-xl p-4 border border-gray-800">
                  <Icon className="w-5 h-5 text-gray-400 mb-4" />
                  <h3 className="text-white font-medium mb-2">{feature.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
