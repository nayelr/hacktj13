"use client";

import { AudioLines, RefreshCw, Clock } from "lucide-react";

const features = [
  { icon: AudioLines, title: "Personalized voices", description: "Tailor your agent's voice to match your brand" },
  { icon: RefreshCw, title: "Dynamic interrupts", description: "Designed to adapt to a global audience" },
  { icon: Clock, title: "Ultra-low latency", description: "Industry-leading voice response time" },
];

export function NaturalVoice() {
  return (
    <section id="voice" className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-xs uppercase tracking-wider text-gray-500">Natural Voice</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight">Engage with empathy</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="feature-card rounded-xl p-4 border border-gray-800">
                <feature.icon className="w-5 h-5 text-gray-400 mb-4" />
                <h3 className="text-white font-medium mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
