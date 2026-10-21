import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import HeroScene from "../components/HeroScene";
import GlassCard from "../components/GlassCard";
import AnimatedText from "../components/AnimatedText";
import Counter from "../components/Counter";
import Footer from "../components/Footer";
import homeHero from "../assets/images/home-hero.jpg";
import homeComparison from "../assets/images/home-comparison.jpg";
import "./Home.css";

function HomeImageBanner({ src, alt, withScanLine }) {
  return (
    <motion.div
      className="home-banner"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="home-banner-wrap">
        <img src={src} alt={alt} />
        {withScanLine && <div className="scan-line" />}
      </div>
    </motion.div>
  );
}

function Home() {
  const navigate = useNavigate();

  return (
    <div>
      {/* 1. HERO */}
      <section className="hero">
        <div className="hero-grid" />
        <HeroScene />
        <div className="hero-content">
          <AnimatedText as="span" className="eyebrow">
            MULTI-MODAL DETECTION
          </AnimatedText>
          <AnimatedText as="h1" delay={0.1}>
            Trust What You See. Verify What You<span className="text-gradient"> Click.</span>
          </AnimatedText>
          <AnimatedText as="p" delay={0.2}>
            Check an image, video, audio clip, website link or QR code from one
            workspace. Sign in to upload supported files and keep your history.
          </AnimatedText>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <motion.button
              className="primary-btn"
              onClick={() => navigate("/detect")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              Try Now
            </motion.button>
            <motion.button
              className="ghost-btn"
              onClick={() => navigate("/about")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              Learn More
            </motion.button>
          </motion.div>

          <motion.div
            className="hero-badges"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <span className="hero-badge">
              <span className="badge-dot" /> 5 Input Types
            </span>
            <span className="hero-badge">
              <span className="badge-dot pink" /> Protected File Uploads
            </span>
          </motion.div>
        </div>

        <motion.div
          className="scroll-indicator"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <span />
        </motion.div>
      </section>

      <HomeImageBanner
        src={homeHero}
        alt="A visual example of image manipulation checks"
        withScanLine
      />

      {/* DETECTION MODES */}
      <section className="section mode-showcase">
        <AnimatedText as="h2" className="section-title">
          One workspace, five ways to check
        </AnimatedText>
        <AnimatedText delay={0.1}>
          <p className="mode-showcase-lead">
            Choose the input that matches what you want to review. Each option opens its matching screen in the Detection Studio.
          </p>
        </AnimatedText>
        <div className="mode-showcase-grid">
          {[
            { mode: "image", title: "Image", detail: "JPG or PNG" },
            { mode: "video", title: "Video", detail: "MP4, MOV, AVI or WEBM" },
            { mode: "audio", title: "Audio", detail: "MP3, WAV, M4A and more" },
            { mode: "url", title: "Website URL", detail: "HTTP or HTTPS link" },
            { mode: "qr", title: "QR Code", detail: "Upload a clear QR image" },
          ].map((item, i) => (
            <motion.button
              type="button"
              key={item.mode}
              className="mode-showcase-card glass-card"
              onClick={() => navigate(`/detect?mode=${item.mode}`)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="mode-showcase-number">{String(i + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <span className="mode-showcase-open">Open detector <span aria-hidden="true">→</span></span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 2. HOW IT WORKS */}
      <section className="section cards-section">
        <AnimatedText as="h2" className="section-title">
          How It Works
        </AnimatedText>
        <div className="cards">
          {[
            { title: "Choose an input", desc: "Select image, video, audio, URL or QR code." },
            { title: "Add your content", desc: "Upload a supported file or enter a website link." },
            { title: "Review activity", desc: "See saved file uploads in your account history." },
          ].map((item, i) => (
            <AnimatedText key={item.title} delay={i * 0.15}>
              <GlassCard className="card">
                <div className="card-index">{`0${i + 1}`}</div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </GlassCard>
            </AnimatedText>
          ))}
        </div>
      </section>

      {/* 3. BY THE NUMBERS */}
      <section className="section stats-section">
        <AnimatedText as="h2" className="section-title">
          By the Numbers
        </AnimatedText>

        <div className="stats-grid">
          <Counter to={5} suffix="" label="Supported Input Types" />
          <Counter to={4} suffix="" label="File Upload Types" />
          <Counter to={2} suffix="" label="Supported URL Schemes" />
          <Counter to={50} suffix="MB" label="Maximum Upload Size" />
        </div>

        <div className="stats-grid stats-grid-secondary">
          {[
            { label: "Image", value: "JPG / PNG" },
            { label: "Video", value: "MP4 / MOV" },
            { label: "Audio", value: "MP3 / WAV" },
            { label: "Links & QR", value: "URL / Image" },
          ].map((item, i) => (
            <AnimatedText key={item.label} delay={i * 0.1}>
              <div className="stat-item">
                <h2 className="stat-number stat-text">{item.value}</h2>
                <p className="stat-label">{item.label}</p>
              </div>
            </AnimatedText>
          ))}
        </div>
      </section>

      <HomeImageBanner
        src={homeComparison}
        alt="Authentic versus manipulated media comparison"
      />

      {/* 4. LIVE DEMO PREVIEW */}
      <section className="section demo-section">
        <AnimatedText as="h2" className="section-title">
          Open a Detection Mode
        </AnimatedText>
        <AnimatedText delay={0.1}>
          <GlassCard className="demo-card">
            <div className="demo-preview">
              <div className="scan-line" />
              <p>Choose image, video, audio, URL or QR code to open its input screen.</p>
            </div>
            <motion.button
              className="primary-btn"
              onClick={() => navigate("/detect")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              Launch Detector
            </motion.button>
          </GlassCard>
        </AnimatedText>
      </section>

      {/* 5. WHY DEEPSHIELD */}
      <section className="section why-section">
        <AnimatedText as="h2" className="section-title">
          Why DeepShield
        </AnimatedText>
        <div className="why-layout">
          <AnimatedText className="why-image-wrap">
            <img src="/images/scan-1.jpg" alt="Biometric scan technology" className="why-image" />
          </AnimatedText>
          <div className="why-list">
            {[
              { title: "Five input types", desc: "Start with an image, video, audio clip, website URL or QR code image." },
              { title: "Account-protected uploads", desc: "Supported files are uploaded through your authenticated account and listed in your history." },
              { title: "Detector-ready workflow", desc: "Each modality has a dedicated input screen, ready for its analysis service to provide results." },
            ].map((item, i) => (
              <AnimatedText key={item.title} delay={i * 0.15}>
                <div className="why-item">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </AnimatedText>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Home;