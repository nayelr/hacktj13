"use client";

import { Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function VoiceExperience() {
  const [muted, setMuted] = useState(true);

  return (
    <section className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl overflow-hidden bg-[#1a1815] card-gradient-border">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-teal-400">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-white font-medium">IVR tree map</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                Every discovered node is clickable. Expand to see menu depth, retry count, outcome, and the full transcript for that path. Green = automated, red = human transfer, yellow = partial.
              </p>
              <Link href="/calpen" className="inline-flex items-center gap-2 border border-gray-700 rounded-full px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors w-fit">
                Run a test
              </Link>
            </div>
            <div className="relative h-80 md:h-auto">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80')` }}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
                Am I really...
              </div>
              <button
                onClick={() => setMuted(!muted)}
                className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm hover:bg-black/70 transition-colors"
              >
                {muted ? <><VolumeX className="w-4 h-4" /> Unmute</> : <><Volume2 className="w-4 h-4" /> Mute</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
