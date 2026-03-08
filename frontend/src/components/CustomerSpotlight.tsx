"use client";

import Link from "next/link";

export function CustomerSpotlight() {
  return (
    <section className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-orange-500 rounded-full" />
            <span className="text-xs uppercase tracking-wider text-gray-500">Why Pentra</span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight">
            Know exactly where
            <br />
            your IVR breaks
          </h2>
        </div>
        <div className="rounded-2xl overflow-hidden bg-[#1a1815] card-gradient-border">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative h-80 md:h-auto min-h-[400px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1526367790999-0150786686a2?w=800&q=80')` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Typical run</p>
                <p className="text-5xl font-light text-white">4 agents</p>
              </div>
            </div>
            <div className="p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-white font-medium">Pentra</span>
              </div>
              <h3 className="text-2xl text-white font-medium mb-4">
                Full IVR tree map, human necessity score, and ranked friction points—in one run.
              </h3>
              <Link href="/pentra" className="inline-flex items-center gap-2 bg-[#252320] rounded-lg px-4 py-2 text-sm text-white hover:bg-[#2a2825] transition-colors w-fit mb-8">
                Launch penetration test
              </Link>
              <div className="border-t border-gray-800 pt-6">
                <p className="text-gray-400 text-sm leading-relaxed">
                  AI agents call your number sequentially, explore every branch, and build the tree in real time. No manual dialing. Get an audit report with clickable nodes and transcripts so you can fix the gaps that send callers to humans.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
