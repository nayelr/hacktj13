import Link from "next/link";
import { Navbar } from "@/components/Navbar";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#13110e] text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto py-20 px-6">
        <h1 className="font-serif text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: March 2026</p>
        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <p>
            By using Pentra&apos;s IVR penetration testing service, you agree to these terms.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Use of the service</h2>
          <p>
            You may use Pentra only for lawful purposes and only on phone numbers and systems you are authorized to test. You are responsible for ensuring that your use complies with applicable laws and that you have any required consent (e.g., from the owner of the phone number or system).
          </p>
          <h2 className="font-serif text-xl text-white mt-8">No warranty</h2>
          <p>
            The service is provided &quot;as is&quot;. We do not guarantee accuracy of audit results, completeness of IVR coverage, or uninterrupted availability. Use audit reports as one input to your own evaluation, not as sole basis for decisions.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Limitation of liability</h2>
          <p>
            To the extent permitted by law, Pentra and its providers shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Changes</h2>
          <p>
            We may update these terms from time to time. Continued use after changes constitutes acceptance. For material changes, we will post notice on the site or via email where appropriate.
          </p>
          <h2 className="font-serif text-xl text-white mt-8">Contact</h2>
          <p>
            Questions about these terms can be directed to the contact information in the footer.
          </p>
        </div>
        <Link href="/" className="inline-block mt-12 text-gray-400 hover:text-white transition-colors text-sm">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
