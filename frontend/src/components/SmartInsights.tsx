"use client";

import { Lightbulb, ChevronDown, Plus, ArrowUp, ChevronLeft, ChevronRight, Filter, RotateCcw, Sparkles } from "lucide-react";

const insights = [
  { type: "Policy Modification", title: "Add self-service reservation modification flow", progress: 85, color: "bg-teal-500" },
  { type: "Knowledge Gap", title: "Add FAQ and handling rules", progress: 70, color: "bg-teal-400" },
  { type: "Policy Modification", title: "Add fallback search flow for missing confirmation", progress: 55, color: "bg-teal-500" },
  { type: "Policy Modification", title: "Streamline unspecific transfer flow", progress: 95, color: "bg-teal-500" },
];

const steps = [
  { title: "Choose an objective", active: false },
  { title: "Generate insights", active: false },
  { title: "Validate at scale", active: true, description: "Review transcripts, run hypotheses across thousands of calls, and confirm the root cause." },
];

export function SmartInsights() {
  return (
    <section id="insights" className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl overflow-hidden bg-[#1a1815] card-gradient-border">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-6 relative">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80')` }}
              />
              <div className="relative z-10 bg-[#1e1c19]/90 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-4">
                  <button className="flex items-center gap-2 text-xs bg-[#252320] rounded-lg px-3 py-2 text-white">
                    Resolution Rate Improvement (Voice)
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button className="flex items-center gap-2 text-xs bg-[#252320] rounded-lg px-3 py-2 text-white">
                    Voice
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <button className="flex items-center gap-2 text-xs bg-white text-black rounded-lg px-3 py-2">
                    <Plus className="w-3 h-3" /> Generate insights
                  </button>
                  <div className="flex items-center gap-1 ml-auto">
                    <button className="p-1.5 text-gray-500 hover:text-white"><Filter className="w-4 h-4" /></button>
                    <button className="p-1.5 text-gray-500 hover:text-white"><RotateCcw className="w-4 h-4" /></button>
                    <button className="p-1.5 text-gray-500 hover:text-white"><Sparkles className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-white font-medium">Resolution Rate Improvement</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-3xl font-light text-white">25.0%</span>
                      <span className="flex items-center text-green-400 text-sm"><ArrowUp className="w-3 h-3" /> 14%</span>
                    </div>
                    <p className="text-gray-500 text-sm">1,302 of 2,170 tickets</p>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <ChevronLeft className="w-4 h-4" />
                    <span>Insight 1 of 28</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-3">
                  {insights.map((insight, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs">{insight.type}</span>
                        <span className="text-gray-400 text-xs">{insight.title}</span>
                      </div>
                      <div className="h-2 bg-[#252320] rounded-full overflow-hidden">
                        <div className={`h-full ${insight.color} rounded-full animate-progress`} style={{ width: `${insight.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <span className="text-white font-medium text-lg">Smart Insights</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                Your agent will surface patterns and uncover root causes, then offer tips on how to update your policies to improve support performance, based on the success metrics you choose.
              </p>
              <a href="#" className="inline-flex items-center gap-2 border border-gray-700 rounded-full px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors w-fit mb-8">
                Explore Smart Insights
              </a>
              <div className="space-y-4 border-t border-gray-800 pt-6">
                {steps.map((step) => (
                  <div key={step.title} className={step.active ? "text-white" : "text-gray-500"}>
                    <h4 className="font-medium">{step.title}</h4>
                    {step.description && <p className="text-gray-400 text-sm mt-1 leading-relaxed">{step.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
