"use client";

import { useState } from "react";
import { FileText, Image, Music, MessageSquare, Mic, Sparkles, Folder, Minus } from "lucide-react";
import Link from "next/link";

const steps = [
  { title: "Create the agent", description: "Ground agents in your brand standards, compliance rules, and workflows so every interaction is consistent and on-policy." },
  { title: "Define policies", description: "" },
  { title: "Design the logic", description: "" },
  { title: "Test and launch", description: "" },
  { title: "Monitor and improve", description: "" },
];

export function AgentCanvas() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="agent-canvas" className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl overflow-hidden bg-[#1a1815] card-gradient-border">
          <div className="p-8 pb-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid grid-cols-2 gap-0.5">
                <span className="w-2 h-2 bg-orange-500 rounded-sm" />
                <span className="w-2 h-2 bg-orange-500 rounded-sm" />
                <span className="w-2 h-2 bg-orange-500 rounded-sm" />
                <span className="w-2 h-2 bg-orange-500 rounded-sm" />
              </div>
              <span className="text-white font-medium">Agent Canvas</span>
            </div>
            <p className="text-gray-500 text-sm mb-4 max-w-sm">
              The fastest way to build, govern, and scale enterprise AI agents.
            </p>
            <Link href="#" className="inline-flex items-center gap-2 border border-gray-700 rounded-full px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors">
              Explore Agent Canvas
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-8 p-8">
            <div className="space-y-0">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className={`border-t border-gray-800 py-4 cursor-pointer transition-colors ${activeStep === index ? "text-white" : "text-gray-500"}`}
                  onMouseEnter={() => setActiveStep(index)}
                >
                  <h4 className="font-medium">{step.title}</h4>
                  {activeStep === index && step.description && (
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">{step.description}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="relative min-h-[400px]">
              <div
                className="absolute inset-0 rounded-2xl bg-cover bg-center opacity-40"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80')` }}
              />
              <div className="relative z-10 m-4 bg-[#1e1c19] rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-center p-4 border-b border-gray-800">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
                  <span className="ml-2 text-white text-sm">Create new agent</span>
                </div>
                <div className="flex border-b border-gray-800">
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 text-sm bg-[#252320] text-white">
                    <MessageSquare className="w-4 h-4" /> Chat
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-white transition-colors">
                    <Mic className="w-4 h-4" /> Voice
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-gray-500 hover:text-white transition-colors">
                    <Sparkles className="w-4 h-4" /> Multi-modal
                  </button>
                </div>
                <div className="p-4">
                  <h5 className="text-white text-sm font-medium mb-1">Add training documents</h5>
                  <p className="text-gray-500 text-xs mb-4">Attach files to give your agent business context</p>
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-gray-600 transition-colors">
                    <div className="flex items-center justify-center gap-4 text-gray-500 mb-3">
                      <Folder className="w-5 h-5" />
                      <Minus className="w-5 h-5 text-orange-500" />
                      <FileText className="w-5 h-5" />
                      <Image className="w-5 h-5" />
                      <Music className="w-5 h-5" />
                    </div>
                    <p className="text-gray-500 text-sm">Drag files here or click to browse</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-gray-800">
                  <button className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
                  <button className="px-4 py-2 text-sm bg-white text-black rounded-lg hover:bg-gray-100 transition-colors">Create agent</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
