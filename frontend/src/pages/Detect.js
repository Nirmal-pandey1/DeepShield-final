import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedText from "../components/AnimatedText";
import GlassCard from "../components/GlassCard";
import Footer from "../components/Footer";
import { useAuth, API_BASE } from "../context/AuthContext";
import heroScan from "../assets/images/hero-scan.jpg";
import neuralNetwork from "../assets/images/neural-network.jpg";
import "./Detect.css";

const MAX_FILE_MB = 50;
const MODES = [
  { id: "image", label: "Image", hint: "JPG, PNG", accept: "image/jpeg,image/png", extensions: [".jpg", ".jpeg", ".png"] },
  { id: "video", label: "Video", hint: "MP4, MOV, AVI", accept: "video/mp4,video/quicktime,video/webm,video/x-msvideo,.avi", extensions: [".mp4", ".mov", ".avi", ".webm"] },
  { id: "audio", label: "Audio", hint: "MP3, WAV, M4A", accept: "audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/flac,.m4a", extensions: [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"] },
  { id: "url", label: "URL", hint: "Web links", extensions: [] },
  { id: "qr", label: "QR Code", hint: "JPG, PNG", accept: "image/jpeg,image/png", extensions: [".jpg", ".jpeg", ".png"] },
];

const MODE_TEXT = {
  image: { title: "Upload an image", description: "Choose a clear image to check.", empty: "Drop an image here", button: "Upload Image" },
  video: { title: "Upload a video", description: "Choose a video file to check.", empty: "Drop a video here", button: "Upload Video" },
  audio: { title: "Upload audio", description: "Choose an audio recording to check.", empty: "Drop an audio file here", button: "Upload Audio" },
  qr: { title: "Upload a QR code", description: "Choose an image that contains a QR code.", empty: "Drop a QR code image here", button: "Upload QR Image" },
};

function ModeIcon({ mode }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  if (mode === "image") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3" y="3" width="18" height="18" rx="4" /><circle {...common} cx="8.5" cy="8.5" r="1.5" /><path {...common} d="m21 15-5-5L5 21" /></svg>;
  if (mode === "video") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="3" y="5" width="18" height="14" rx="3" /><path {...common} d="m10 9 5 3-5 3z" /></svg>;
  if (mode === "audio") return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 10v4m4-8v12m4-15v18m4-13v8m4-11v14" /></svg>;
  if (mode === "url") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M3.5 9h17M3.5 15h17M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-2zM14 18h2v2h-2z" /></svg>;
}

function Detect() {
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState(() => MODES.some((item) => item.id === requestedMode) ? requestedMode : "image");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploaded, setUploaded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [urlValue, setUrlValue] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const { token, logout } = useAuth();
  const activeMode = MODES.find((item) => item.id === mode);
  const modeText = MODE_TEXT[mode];

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const chooseMode = (nextMode) => {
    if (preview) URL.revokeObjectURL(preview);
    setMode(nextMode);
    setFile(null);
    setPreview(null);
    setUploaded(false);
    setAnalysis(null);
    setUrlValue("");
    setUrlReady(false);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const applyFile = (selected) => {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!activeMode.extensions.some((extension) => name.endsWith(extension))) {
      setError(`Unsupported file type for ${activeMode.label.toLowerCase()} detection.`);
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File too large. The limit is ${MAX_FILE_MB} MB.`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setError("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setUploaded(false);
    setAnalysis(null);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    applyFile(event.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError(mode === "qr" ? "Select a QR code image first." : "Select a file first.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    try {
      setLoading(true);
      setUploaded(false);
      setAnalysis(null);
      setError("");
      const endpoint = mode === "image" ? "/analyze/image" : "/upload";
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) {
        if (response.status === 401) {
          logout();
          return;
        }
        let detail = "";
        try {
          const body = await response.json();
          if (typeof body.detail === "string") detail = body.detail;
        } catch (_) {}
        if (response.status === 413) setError(`File too large. The limit is ${MAX_FILE_MB} MB.`);
        else setError(detail || "Upload failed. Please try another file.");
        return;
      }
      if (mode === "image") {
        setAnalysis(await response.json());
      }
      setUploaded(true);
    } catch (requestError) {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlCheck = (event) => {
    event.preventDefault();
    setError("");
    setUrlReady(false);
    try {
      const parsed = new URL(urlValue.trim());
      if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) throw new Error("Invalid URL");
      setUrlValue(parsed.href);
      setUrlReady(true);
    } catch (_) {
      setError("Enter a valid web address beginning with http:// or https://.");
    }
  };

  const handleReset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setUploaded(false);
    setAnalysis(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="detect-page">
      <section className="detect-intro">
        <div className="detect-intro-grid">
          <div className="detect-intro-text-col">
            <AnimatedText as="span" className="eyebrow">DETECTION STUDIO</AnimatedText>
            <AnimatedText as="h1" delay={0.1}>Choose what to <span className="text-gradient">check</span></AnimatedText>
            <AnimatedText delay={0.2}>
              <p className="detect-intro-text">
                Select a detection type, then add an image, video, audio file,
                web link, or QR code.
              </p>
            </AnimatedText>
          </div>
          <motion.div className="detect-intro-image-col" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <div className="detect-hero-image-wrap"><img src={heroScan} alt="Media detection preview" /></div>
          </motion.div>
        </div>
      </section>

      <section className="detect-tool-section">
        <div className="detect-content">
          <div className="detect-mode-grid" role="tablist" aria-label="Choose detection type">
            {MODES.map((item) => (
              <button
                type="button"
                key={item.id}
                role="tab"
                aria-selected={mode === item.id}
                className={`detect-mode-card ${mode === item.id ? "active" : ""}`}
                onClick={() => chooseMode(item.id)}
              >
                <span className="detect-mode-icon"><ModeIcon mode={item.id} /></span>
                <span className="detect-mode-label">{item.label}</span>
                <span className="detect-mode-hint">{item.hint}</span>
              </button>
            ))}
          </div>

          <motion.div className="detect-wrapper" key={mode} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="detect-card glass-card">
              <div className="detect-mode-heading">
                <span className="eyebrow">{mode === "qr" ? "QR SCANNER" : `${activeMode.label.toUpperCase()} DETECTION`}</span>
                <h2>{mode === "url" ? "Check a web link" : modeText.title}</h2>
                <p>{mode === "url" ? "Paste a web address to prepare it for URL analysis." : modeText.description}</p>
              </div>

              {mode === "url" ? (
                <form className="url-check-form" onSubmit={handleUrlCheck}>
                  <label htmlFor="detection-url">Website URL</label>
                  <div className="url-input-wrap">
                    <ModeIcon mode="url" />
                    <input
                      id="detection-url"
                      type="url"
                      value={urlValue}
                      onChange={(event) => { setUrlValue(event.target.value); setUrlReady(false); }}
                      placeholder="https://example.com"
                      autoComplete="url"
                      required
                    />
                  </div>
                  <p className="url-input-hint">Only HTTP and HTTPS links are accepted.</p>
                  <motion.button type="submit" className="primary-btn analyze-btn" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Check URL</motion.button>
                </form>
              ) : (
                <>
                  <div
                    className={`drop-zone ${dragActive ? "drop-zone-active" : ""}`}
                    onDrop={handleDrop}
                    onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                    onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input type="file" accept={activeMode.accept} ref={fileInputRef} onChange={(event) => applyFile(event.target.files[0])} style={{ display: "none" }} />
                    {!preview && (
                      <div className="drop-zone-placeholder">
                        <span className="drop-zone-large-icon"><ModeIcon mode={mode} /></span>
                        <p className="drop-zone-title">{modeText.empty}</p>
                        <p className="drop-zone-sub">or click to browse - up to 50 MB</p>
                      </div>
                    )}
                    {preview && (
                      <div className="preview">
                        {loading && <div className="scan-overlay" />}
                        {mode === "image" || mode === "qr" ? <img src={preview} alt={mode === "qr" ? "Selected QR code image" : "Selected image"} /> :
                          mode === "video" ? <video src={preview} controls /> :
                          <div className="audio-preview"><ModeIcon mode="audio" /><span>{file.name}</span><audio src={preview} controls /></div>}
                      </div>
                    )}
                  </div>
                  {file && <p className="selected-file-name">{file.name}</p>}
                  <motion.button className="primary-btn analyze-btn" onClick={handleUpload} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={loading}>
                    {loading ? "Uploading..." : modeText.button}
                  </motion.button>
                </>
              )}

              {error && <p className="detect-error" role="alert">{error}</p>}
              {loading && <div className="spinner"></div>}

              <AnimatePresence>
                {uploaded && mode === "image" && analysis && (
                  <motion.div className="result-box upload-result" initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <h3 className={analysis.prediction === "REAL" ? "real" : "fake"}>
                      {analysis.prediction === "FAKE" ? "DEEPFAKE DETECTED" : "LIKELY REAL"}
                    </h3>
                    <p className="confidence-label">
                      Confidence: {Number(analysis.confidence).toFixed(1)}% · Real: {(Number(analysis.real_probability) * 100).toFixed(1)}% · Fake: {(Number(analysis.fake_probability) * 100).toFixed(1)}%
                    </p>
                    <p className="confidence-label">Threat level: {analysis.threat_level}</p>
                    <motion.button className="reset-btn" onClick={handleReset} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Choose Another File</motion.button>
                  </motion.div>
                )}
                {uploaded && mode !== "image" && (
                  <motion.div className="result-box upload-result" initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <h3 className="real">UPLOAD COMPLETE</h3>
                    <p className="confidence-label">
                      {mode === "qr" ? "QR image saved. Scan results will appear when the QR detector is connected." : "File saved. Detection results will appear when the analysis service is connected."}
                    </p>
                    <motion.button className="reset-btn" onClick={handleReset} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>Choose Another File</motion.button>
                  </motion.div>
                )}
                {urlReady && (
                  <motion.div className="result-box url-ready-result" initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <h3 className="real">URL READY</h3>
                    <p className="confidence-label">
                      {new URL(urlValue).hostname} is valid. URL analysis results will appear here when the detector is connected.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="detect-section">
        <AnimatedText as="h2" className="section-title">One place for every check</AnimatedText>
        <motion.div className="how-it-works-banner" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}>
          <img src={neuralNetwork} alt="Detection types for images, video, audio, links and QR codes" />
        </motion.div>
        <div className="mini-steps">
          {[
            { step: "01", title: "Choose a detector", desc: "Select image, video, audio, URL, or QR code." },
            { step: "02", title: "Add your input", desc: "Upload a supported file or paste a web link." },
            { step: "03", title: "Review the result", desc: "The connected detector will show its result here." },
          ].map((item, i) => (
            <AnimatedText key={item.step} delay={i * 0.15}>
              <GlassCard className="mini-step-card">
                <span className="mini-step-number">{item.step}</span><h3>{item.title}</h3><p>{item.desc}</p>
              </GlassCard>
            </AnimatedText>
          ))}
        </div>
      </section>

      <section className="detect-section tips-section">
        <AnimatedText as="h2" className="section-title">Supported inputs</AnimatedText>
        <div className="tips-grid">
          {[
            "Images: JPG, JPEG and PNG.",
            "Video: MP4, MOV, AVI and WEBM.",
            "Audio: MP3, WAV, M4A, AAC, OGG and FLAC.",
            "URL: paste an HTTP or HTTPS web address.",
            "QR Code: upload a clear JPG or PNG image.",
            "Files may be up to 50 MB.",
          ].map((tip, i) => (
            <AnimatedText key={tip} delay={i * 0.08}>
              <div className="tip-item"><span className="tip-marker" /><p>{tip}</p></div>
            </AnimatedText>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default Detect;
