"use client";

import Link from "next/link";

const productLinks = [
  { name: "Agent Canvas", href: "#agent-canvas" },
  { name: "Insights", href: "#insights" },
  { name: "Voice Experience", href: "#voice" },
  { name: "Browser Agent", href: "#" },
];

const companyLinks = [
  { name: "Careers", href: "#" },
  { name: "Contact", href: "#contact" },
  { name: "Trust Center", href: "#" },
];

const resourceLinks = [
  { name: "News", href: "#" },
  { name: "Privacy Policy", href: "#" },
  { name: "Terms Of Service", href: "#" },
];

export function Footer() {
  return (
    <footer className="bg-[#13110e] pt-16 pb-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-8">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
              </svg>
              <span className="text-lg font-semibold text-white">Giga</span>
            </Link>
            <div className="space-y-4">
              <span className="inline-block text-xs border border-gray-700 rounded-full px-3 py-1 text-gray-400">Compliant</span>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#1a1815] flex items-center justify-center border border-gray-700">
                  <span className="text-xs text-gray-400">SOC2</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#1a1815] flex items-center justify-center border border-gray-700">
                  <span className="text-xs text-gray-400">ISO</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#1a1815] flex items-center justify-center border border-gray-700">
                  <span className="text-xs text-gray-400">ISO</span>
                </div>
                <span className="text-gray-500 text-sm ml-2">5+</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-gray-500 font-medium mb-4">Product</h4>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-gray-500 font-medium mb-4">Company</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-gray-500 font-medium mb-4">Resources</h4>
            <ul className="space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-gray-400 hover:text-white transition-colors">{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">© 2026 Giga AI, Inc.</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </Link>
            <span className="text-gray-700">|</span>
            <Link href="#" className="text-gray-500 hover:text-white transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
