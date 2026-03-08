import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Stats } from "@/components/Stats";
import { CustomAgents } from "@/components/CustomAgents";
import { CTA } from "@/components/CTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#13110e] text-white">
      <Navbar />
      <Hero />
      <Stats />
      <CustomAgents />
      <CTA />
      <Footer />
    </main>
  );
}
