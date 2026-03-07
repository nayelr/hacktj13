"use client";

import Link from "next/link";

export function CustomerSpotlight() {
  return (
    <section className="bg-[#13110e] py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-orange-500 rounded-full" />
            <span className="text-xs uppercase tracking-wider text-gray-500">Customer Spotlight</span>
          </div>
          <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight">
            See how enterprises scaled
            <br />
            customer engagement with Giga
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
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">DWR Rate</p>
                <p className="text-5xl font-light text-white">80%</p>
              </div>
            </div>
            <div className="p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#FF3008"/>
                  <path d="M8 10h8M8 14h5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-[#FF3008] font-bold text-lg tracking-wide">DOORDASH</span>
              </div>
              <h3 className="text-2xl text-white font-medium mb-4">
                How DoorDash and Giga built reliable support at scale
              </h3>
              <Link href="#" className="inline-flex items-center gap-2 bg-[#252320] rounded-lg px-4 py-2 text-sm text-white hover:bg-[#2a2825] transition-colors w-fit mb-8">
                Learn more
              </Link>
              <div className="border-t border-gray-800 pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center">
                    <span className="text-white font-medium">AF</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">Andy Fang</p>
                    <p className="text-gray-500 text-sm">Co-Founder at DoorDash</p>
                  </div>
                </div>
                <blockquote className="text-gray-400 text-sm leading-relaxed">
                  &quot;At DoorDash, we operate at a massive scale across services, platforms, and languages. Giga leveraged usage data to deliver measurable improvements, including fewer escalations, faster resolution paths, and more efficient workflows across our teams. As we continue to grow across more than 40 countries and serve nearly 50 million people each month, partnerships like this are critical to delivering better outcomes for consumers on a global scale&quot;
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
