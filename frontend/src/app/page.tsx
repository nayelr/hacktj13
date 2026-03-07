import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Stats } from "@/components/Stats";
import { CustomAgents } from "@/components/CustomAgents";
import { AgentCanvas } from "@/components/AgentCanvas";
import { SmartSuggestions } from "@/components/SmartSuggestions";
import { SmartInsights } from "@/components/SmartInsights";
import { NaturalVoice } from "@/components/NaturalVoice";
import { VoiceExperience } from "@/components/VoiceExperience";
import { CustomerSpotlight } from "@/components/CustomerSpotlight";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#13110e]">
      <Navbar />
      <Hero />
      <Stats />
      <CustomAgents />
      <AgentCanvas />
      <SmartSuggestions />
      <SmartInsights />
      <NaturalVoice />
      <VoiceExperience />
      <CustomerSpotlight />
    </main>
  );
}
