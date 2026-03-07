"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  const [productOpen, setProductOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl">
      <div className="glass-nav rounded-full px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
            </svg>
            <span className="text-lg font-semibold">Giga</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <div className="relative">
              <button
                className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
                onMouseEnter={() => setProductOpen(true)}
                onMouseLeave={() => setProductOpen(false)}
              >
                Product
                <ChevronDown className="w-4 h-4" />
              </button>
              {productOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-48 glass-nav rounded-xl p-2"
                  onMouseEnter={() => setProductOpen(true)}
                  onMouseLeave={() => setProductOpen(false)}
                >
                  <Link href="#agent-canvas" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Agent Canvas</Link>
                  <Link href="#insights" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Insights</Link>
                  <Link href="#voice" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Voice Experience</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Browser Agent</Link>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                className="flex items-center gap-1 text-sm text-gray-300 hover:text-white transition-colors"
                onMouseEnter={() => setCompanyOpen(true)}
                onMouseLeave={() => setCompanyOpen(false)}
              >
                Company
                <ChevronDown className="w-4 h-4" />
              </button>
              {companyOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-48 glass-nav rounded-xl p-2"
                  onMouseEnter={() => setCompanyOpen(true)}
                  onMouseLeave={() => setCompanyOpen(false)}
                >
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Careers</Link>
                  <Link href="#contact" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Contact</Link>
                  <Link href="#" className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">Trust Center</Link>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="#" className="text-sm text-gray-300 hover:text-white transition-colors">Sign in</Link>
          <Link href="#contact" className="bg-white text-black text-sm font-medium px-4 py-2 rounded-full hover:bg-gray-100 transition-colors">Talk to us</Link>
        </div>
      </div>
    </nav>
  );
}
