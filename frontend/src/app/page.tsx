import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { CustomAgents } from "@/components/CustomAgents";
import { SmartSuggestions } from "@/components/SmartSuggestions";
import { SmartInsights } from "@/components/SmartInsights";
import { CustomerSpotlight } from "@/components/CustomerSpotlight";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#13110e]">
      <Navbar />
      <Hero />
      <CustomAgents />
      <SmartSuggestions />
      <SmartInsights />
      <CustomerSpotlight />
    </main>
  );
}
