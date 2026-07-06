import React from "react";
import "../styles/landing.css";
import { Navbar } from "../components/home/Navbar";
import { Hero } from "../components/home/Hero";
import { TentangSaku } from "../components/home/TentangSaku";
import { ProblemStatement } from "../components/home/ProblemStatement";
import { Demographics } from "../components/home/Demographics";
import { HowToUse } from "../components/home/HowToUse";
import { DuaProduk } from "../components/home/DuaProduk";
import { Features } from "../components/home/Features";
import { Gallery } from "../components/home/Gallery";
import { FAQs } from "../components/home/FAQs";
import { CTA } from "../components/home/CTA";
import { Footer } from "../components/home/Footer";

export default function LandingPage() {
  return (
    <div className="lp">
      <Navbar />
      <main id="main-content">
        <Hero />
        <TentangSaku />
        <ProblemStatement />
        <Demographics />
        <HowToUse />
        <DuaProduk />
        <Features />
        <Gallery />
        <FAQs />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
