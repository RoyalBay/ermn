function applyTheme() {
  const t = localStorage.getItem("theme") || "classic";
  const themes = {
    classic:   { body:"linear-gradient(180deg,#dfe7f3 0%,#f0f2f5 100%)",card:"#fff",topbar:"#3b5998",text:"#333",border:"#b0b7c3",accent:"#3b5998",cardHeader:"linear-gradient(180deg,#e8edf7,#d8e0f0)",inputBg:"#fafafa",badgeGlow:"none",neonGlow:"none" },
    cherry:    { body:"linear-gradient(180deg,#fff5f7 0%,#fde2e4 100%)",card:"#fff",topbar:"#ffb7c5",text:"#5f4b4b",border:"#ffcad4",accent:"#ff8fa3",cardHeader:"linear-gradient(180deg,#fff5f7,#fde2e4)",inputBg:"#fffcfc",badgeGlow:"none",neonGlow:"none" },
    midnight:  { body:"linear-gradient(180deg,#0a0a1a 0%,#12122a 100%)",card:"#1a1a2e",topbar:"#0d0d1f",text:"#c8d0e8",border:"#2a2a4a",accent:"#7b68ee",cardHeader:"#12122a",inputBg:"#0d0221",badgeGlow:"none",neonGlow:"none" },
    y2k:       { body:"linear-gradient(180deg,#c0e8ff 0%,#e8f4ff 100%)",card:"#fff",topbar:"#0055cc",text:"#002266",border:"#99bbff",accent:"#0055cc",cardHeader:"linear-gradient(180deg,#c0e8ff,#e8f4ff)",inputBg:"#f0f8ff",badgeGlow:"none",neonGlow:"none" },
    limeade:   { body:"linear-gradient(180deg,#e8fce8 0%,#f5fff5 100%)",card:"#f9fff9",topbar:"#2d7a2d",text:"#1a3d1a",border:"#a3d9a3",accent:"#2d7a2d",cardHeader:"linear-gradient(180deg,#e8fce8,#f5fff5)",inputBg:"#f5fff5",badgeGlow:"none",neonGlow:"none" },
    cyberpunk: { body:"linear-gradient(180deg,#0d0221 0%,#0f084b 100%)",card:"#1a1a3a",topbar:"#26084d",text:"#00f2ff",border:"#ff00ff",accent:"#ff00ff",cardHeader:"#26084d",inputBg:"#0d0221",badgeGlow:"drop-shadow(0 0 5px #ff00ff) drop-shadow(0 0 10px #00f2ff)",neonGlow:"0 0 5px #ff00ff, 0 0 10px #ff00ff" },
  };
  const th = themes[t] || themes.classic;
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.setProperty("--body-bg", th.body);
  document.documentElement.style.setProperty("--card-bg", th.card);
  document.documentElement.style.setProperty("--topbar-bg", th.topbar);
  document.documentElement.style.setProperty("--text", th.text);
  document.documentElement.style.setProperty("--border", th.border);
  document.documentElement.style.setProperty("--accent", th.accent);
  document.documentElement.style.setProperty("--card-header", th.cardHeader);
  document.documentElement.style.setProperty("--input-bg", th.inputBg);
  document.documentElement.style.setProperty("--badge-glow", th.badgeGlow);
  document.documentElement.style.setProperty("--neon-glow", th.neonGlow);
  document.body.style.background = th.body;
}
applyTheme();

// Modernize UI Injection
function checkModernize() {
  if (localStorage.getItem("modernize_ui") === "true") {
    if (!document.getElementById("modern-ui-styles")) {
      const link = document.createElement("link");
      link.id = "modern-ui-styles";
      link.rel = "stylesheet";
      link.href = "modern.css";
      document.head.appendChild(link);
    }
    document.body.classList.add("modern-ui");
  } else {
    const link = document.getElementById("modern-ui-styles");
    if (link) link.remove();
    document.body.classList.remove("modern-ui");
  }
}

// Initial check
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", checkModernize);
} else {
  checkModernize();
}
