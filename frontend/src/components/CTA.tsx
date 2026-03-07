"use client";

export function CTA() {
  return (
    <section id="contact" className="relative py-32 px-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#13110e] via-[#13110e]/50 to-[#13110e]" />
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-xs uppercase tracking-wider text-gray-500">Get a Personalized Demo</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-white leading-tight">
              Ready to see the Giga AI agent in action?
            </h2>
          </div>
          <div>
            <p className="text-gray-400 leading-relaxed mb-6">
              Giga&apos;s AI agents handle complex workflows at scale, from live delivery issues to compliance decisions, while maintaining over 90% resolution accuracy in production.
            </p>
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 font-medium hover:bg-gray-100 transition-colors"
            >
              Talk to us
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
