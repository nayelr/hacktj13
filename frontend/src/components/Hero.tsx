"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#13110e]/60 via-[#13110e]/40 to-[#13110e]" />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 pt-32">
        <Link
          href="/calpen"
          className="inline-flex items-center gap-2 glass-nav rounded-full px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors mb-8 animate-fade-in-up"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full pulse-indicator" />
          <span className="tracking-wider uppercase text-xs">IVR penetration testing</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="ml-1">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl text-white max-w-4xl leading-tight animate-fade-in-up animate-delay-100">
          Find where your
          <br />
          phone system fails.
        </h1>
        <p className="text-gray-400 text-lg md:text-xl mt-6 max-w-xl animate-fade-in-up animate-delay-200">
          Automated IVR audits—AI agents call every branch and map friction points.
        </p>
        <Link
          href="/calpen"
          className="mt-8 bg-white text-black font-medium px-6 py-3 rounded-full hover:bg-gray-100 transition-colors animate-fade-in-up animate-delay-300"
        >
          Launch penetration test
        </Link>
      </div>
    </section>
  );
}
