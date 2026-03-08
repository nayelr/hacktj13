import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#13110e] text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto py-20 px-6">
        <h1 className="font-serif text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: March 2026</p>
        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <p>
            Pentra (&quot;we&quot;, &quot;us&quot;) respects your privacy. This policy describes how we collect, use, and protect information when you use our IVR penetration testing service.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Information we collect</h2>
          <p>
            When you run a penetration test, we process the phone number you provide, a short business description, and the results of automated call tests (e.g., call duration, transcript excerpts, and issue summaries). We do not store full call recordings by default unless you explicitly enable that option.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">How we use it</h2>
          <p>
            We use this information solely to generate your audit report and to improve our service. We do not sell or share your data with third parties for marketing. Our AI analysis providers (e.g., for transcript analysis) may process data under their respective privacy terms.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Data retention</h2>
          <p>
            Report data may be retained for a limited period to allow you to revisit results. You may request deletion of your data by contacting us.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Contact</h2>
          <p>
            For privacy-related questions, contact us at the address or link provided in the footer.
          </p>
        </div>
        <Link href="/" className="inline-block mt-12 text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
