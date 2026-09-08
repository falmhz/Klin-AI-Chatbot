// ─────────────────────────────────────────────────────────────────────────────
// script.js — Klin Chat Dark Workspace
//
// Responsibilities (original):
//   - Multi-turn conversation state (send to /api/chat)
//   - Render user + model message bubbles with avatars + timestamps
//   - Thinking animation bubble
//   - Sidebar: toggle open/close, mobile backdrop, responsive detection
//   - Chat reset: clear conversation + restore empty state
//   - Sidebar history panel: tracks session snippets
//   - Auto-grow textarea, Enter/Shift+Enter keyboard shortcuts
//   - Toast notifications with auto-dismiss + manual close
//   - Status dot state machine (idle / thinking / error)
//
// New responsibilities:
//   - Settings modal: open/close, API Key show/hide, model selection
//   - localStorage persistence for API Key (key: "klin_api_key") and model
//   - File attachment: FileReader → Base64, preview chip, clear state
//   - Multimodal payload: attach { mimeType, data, fileName } to /api/chat
//   - Render attachment thumbnail/badge inside user chat bubbles
// ─────────────────────────────────────────────────────────────────────────────

// ── DOM References — Original ─────────────────────────────────────────────────
const chatForm        = document.getElementById("chatForm");
const userInput       = document.getElementById("userInput");
const sendBtn         = document.getElementById("sendBtn");
const chatWindow      = document.getElementById("chatWindow");
const emptyState      = document.getElementById("emptyState");
const statusDot       = document.getElementById("statusDot");
const statusLabel     = document.getElementById("statusLabel");
const toast           = document.getElementById("toast");
const toastMessage    = document.getElementById("toastMessage");
const toastClose      = document.getElementById("toastClose");
const resetBtn        = document.getElementById("resetBtn");
const sidebarToggle   = document.getElementById("sidebarToggle");
const sidebar         = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const sidebarHistory  = document.getElementById("sidebarHistory");
const sidebarEmpty    = document.getElementById("sidebarEmpty");

// ── DOM References — Settings Modal ──────────────────────────────────────────
const settingsBtn       = document.getElementById("settingsBtn");
const settingsOverlay   = document.getElementById("settingsOverlay");
const settingsCloseBtn  = document.getElementById("settingsCloseBtn");
const settingsCancelBtn = document.getElementById("settingsCancelBtn");
const settingsSaveBtn   = document.getElementById("settingsSaveBtn");
const apiKeyInput       = document.getElementById("apiKeyInput");
const apiKeyToggleBtn   = document.getElementById("apiKeyToggleBtn");
const modelSelect       = document.getElementById("modelSelect");
const eyeShow           = apiKeyToggleBtn.querySelector(".eye-show");
const eyeHide           = apiKeyToggleBtn.querySelector(".eye-hide");

// ── DOM References — File Upload ──────────────────────────────────────────────
const attachBtn          = document.getElementById("attachBtn");
const fileInput          = document.getElementById("fileInput");
const attachmentPreview  = document.getElementById("attachmentPreview");
const attachmentChip     = document.getElementById("attachmentChip");
const attachmentChipIcon = document.getElementById("attachmentChipIcon");
const attachmentChipName = document.getElementById("attachmentChipName");
const attachmentRemoveBtn = document.getElementById("attachmentRemoveBtn");

// ── localStorage Keys ─────────────────────────────────────────────────────────
const LS_API_KEY = "klin_api_key";
const LS_MODEL   = "klin_model";

// ── Application State ─────────────────────────────────────────────────────────
/**
 * conversation: Array<{ role: "user" | "model", text: string }>
 * Full history sent to the backend on every request for multi-turn context.
 */
let conversation  = [];
let isLoading     = false;
let toastTimer    = null;
let isSidebarOpen = true;   // Desktop default: open

/**
 * pendingAttachment: null | { mimeType: string, data: string, fileName: string }
 * Holds the currently selected file's Base64 payload until the message is sent.
 */
let pendingAttachment = null;

// ── Utility: Format time ──────────────────────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ── Utility: Escape HTML ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}

// ── Utility: Truncate text for sidebar snippet ────────────────────────────────
function truncate(text, max = 38) {
  return text.length > max ? text.slice(0, max).trimEnd() + "..." : text;
}

// ── Status Indicator ──────────────────────────────────────────────────────────
function setStatus(state) {
  const labels = {
    idle:     "Online",
    thinking: "Sedang berpikir...",
    error:    "Terjadi kesalahan",
  };
  statusDot.className     = "status-dot" + (state !== "idle" ? ` ${state}` : "");
  statusLabel.textContent = labels[state] ?? "Online";
}

// ── Composer Lock ─────────────────────────────────────────────────────────────
function setComposerBusy(busy) {
  isLoading          = busy;
  userInput.disabled = busy;
  sendBtn.disabled   = busy;
  attachBtn.disabled = busy;
}

// ── Auto-grow Textarea ────────────────────────────────────────────────────────
function autoGrow() {
  userInput.style.height = "auto";
  userInput.style.height = userInput.scrollHeight + "px";
}

// ── Scroll to Bottom ──────────────────────────────────────────────────────────
function scrollToBottom() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: "smooth" });
}

// ── Empty State ───────────────────────────────────────────────────────────────
function hideEmptyState() {
  if (emptyState && !emptyState.hidden) {
    emptyState.hidden = true;
    emptyState.setAttribute("aria-hidden", "true");
  }
}

function showEmptyState() {
  if (emptyState) {
    emptyState.hidden = false;
    emptyState.removeAttribute("aria-hidden");
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
/**
 * @param {string}  message
 * @param {number}  [duration=5000]
 * @param {"error"|"success"} [variant="error"]
 */
function showToast(message, duration = 5000, variant = "error") {
  if (toastTimer) clearTimeout(toastTimer);

  toastMessage.textContent = message;
  toast.hidden = false;

  // Swap variant class
  toast.classList.remove("success");
  if (variant === "success") toast.classList.add("success");

  void toast.offsetWidth;
  toast.classList.add("visible");

  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  if (toastTimer) clearTimeout(toastTimer);
  toast.classList.remove("visible");
  toast.addEventListener(
    "transitionend",
    () => { toast.hidden = true; },
    { once: true }
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function isMobileViewport() {
  return window.matchMedia("(max-width: 1023px)").matches;
}

function setSidebarOpen(open) {
  isSidebarOpen = open;

  if (open) {
    sidebar.classList.remove("collapsed");
  } else {
    sidebar.classList.add("collapsed");
  }

  sidebarToggle.setAttribute("aria-expanded", String(open));

  if (isMobileViewport()) {
    if (open) {
      sidebarBackdrop.classList.add("visible");
      sidebarBackdrop.removeAttribute("aria-hidden");
      sidebarBackdrop.style.display = "block";
    } else {
      sidebarBackdrop.classList.remove("visible");
      sidebarBackdrop.setAttribute("aria-hidden", "true");
      sidebarBackdrop.addEventListener(
        "transitionend",
        () => { if (!isSidebarOpen) sidebarBackdrop.style.display = "none"; },
        { once: true }
      );
    }
  } else {
    sidebarBackdrop.style.display = "none";
    sidebarBackdrop.setAttribute("aria-hidden", "true");
  }
}

function toggleSidebar() {
  setSidebarOpen(!isSidebarOpen);
}

function applyInitialSidebarState() {
  if (isMobileViewport()) {
    setSidebarOpen(false);
  } else {
    setSidebarOpen(true);
  }
}

// ── Sidebar History Panel ─────────────────────────────────────────────────────
function addHistoryItem(text) {
  if (sidebarEmpty) sidebarEmpty.hidden = true;

  const btn = document.createElement("button");
  btn.className = "history-item";
  btn.setAttribute("type", "button");
  btn.setAttribute("aria-label", `Percakapan: ${text}`);

  btn.innerHTML = `
    <span class="history-dot" aria-hidden="true"></span>
    <span>${escapeHtml(truncate(text))}</span>
  `;

  btn.addEventListener("click", () => {
    document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active"));
    btn.classList.add("active");
    if (isMobileViewport()) setSidebarOpen(false);
  });

  sidebarHistory.prepend(btn);

  document.querySelectorAll(".history-item").forEach(el => el.classList.remove("active"));
  btn.classList.add("active");
}

// ── Chat Reset ────────────────────────────────────────────────────────────────
function resetChat() {
  conversation = [];

  const rows = chatWindow.querySelectorAll(".message-row");
  rows.forEach(row => row.remove());

  showEmptyState();
  setStatus("idle");
  setComposerBusy(false);

  userInput.value = "";
  autoGrow();
  userInput.focus();

  const historyItems = sidebarHistory.querySelectorAll(".history-item");
  historyItems.forEach(item => item.remove());
  if (sidebarEmpty) sidebarEmpty.hidden = false;

  // Clear any pending attachment on reset
  clearAttachment();

  if (isMobileViewport()) setSidebarOpen(false);
}

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Read stored API key and model from localStorage, populate the modal fields.
 */
function loadSettingsFromStorage() {
  const storedKey   = localStorage.getItem(LS_API_KEY) || "";
  const storedModel = localStorage.getItem(LS_MODEL)   || "gemini-3.5-flash";

  apiKeyInput.value   = storedKey;
  modelSelect.value   = storedModel;
}

/** Persist settings to localStorage and close modal. */
function saveSettings() {
  const key   = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (key) {
    localStorage.setItem(LS_API_KEY, key);
  } else {
    localStorage.removeItem(LS_API_KEY);
  }

  localStorage.setItem(LS_MODEL, model);

  // Brief "Saved" feedback on button
  settingsSaveBtn.classList.add("saved");
  const originalHTML = settingsSaveBtn.innerHTML;
  settingsSaveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
         style="width:14px;height:14px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
    Tersimpan!
  `;

  setTimeout(() => {
    settingsSaveBtn.classList.remove("saved");
    settingsSaveBtn.innerHTML = originalHTML;
    closeSettingsModal();
  }, 900);

  showToast("Pengaturan berhasil disimpan.", 2500, "success");
}

function openSettingsModal() {
  loadSettingsFromStorage();
  settingsOverlay.hidden = false;
  // Trigger CSS animation by forcing a reflow
  void settingsOverlay.offsetWidth;
  // Focus the API key field for keyboard users
  apiKeyInput.focus();
}

function closeSettingsModal() {
  settingsOverlay.hidden = true;
}

/** Toggle the API key field between password and plain text. */
function toggleApiKeyVisibility() {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  eyeShow.hidden   = isHidden;   // hide the "open eye" when text is visible
  eyeHide.hidden   = !isHidden;  // show the "closed eye" when text is visible
  apiKeyToggleBtn.setAttribute(
    "aria-label",
    isHidden ? "Sembunyikan API Key" : "Tampilkan API Key"
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE ATTACHMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Clear pending attachment state and hide the preview strip.
 */
function clearAttachment() {
  pendingAttachment = null;
  fileInput.value   = "";
  attachmentPreview.hidden = true;
  attachBtn.classList.remove("has-attachment");

  // Reset chip to default icon state (remove any thumbnail img injected)
  const existingThumb = attachmentChip.querySelector(".attachment-chip-thumb");
  if (existingThumb) existingThumb.remove();

  attachmentChipIcon.hidden = false;
  attachmentChipIcon.textContent = "📄";
  attachmentChipName.textContent = "";
}

/**
 * Read the chosen file via FileReader, build pendingAttachment, render chip.
 * @param {File} file
 */
function handleFileSelected(file) {
  if (!file) return;

  // Guard: only accept images and PDFs
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp",
                   "image/svg+xml", "application/pdf"];
  if (!allowed.includes(file.type)) {
    showToast("Format file tidak didukung. Harap pilih gambar (JPEG, PNG, GIF, WebP) atau PDF.");
    return;
  }

  // 20 MB client-side guard (backend accepts 25 MB, leave headroom for JSON overhead)
  const MAX_BYTES = 20 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    showToast("Ukuran file terlalu besar. Maksimum 20 MB.");
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    const dataUrl   = e.target.result;                  // "data:<mime>;base64,<data>"
    const base64    = dataUrl.split(",")[1];             // raw base64 without prefix
    const mimeType  = file.type;
    const fileName  = file.name;

    pendingAttachment = { mimeType, data: base64, fileName };

    // ── Update chip UI ────────────────────────────────────────────────────
    attachmentChipName.textContent = truncate(fileName, 32);

    if (mimeType.startsWith("image/")) {
      // Show a small thumbnail instead of an emoji icon
      let thumb = attachmentChip.querySelector(".attachment-chip-thumb");
      if (!thumb) {
        thumb = document.createElement("img");
        thumb.className = "attachment-chip-thumb";
        thumb.alt       = fileName;
      }
      thumb.src = dataUrl;
      attachmentChipIcon.hidden = true;
      // Insert thumb before the name span
      attachmentChip.insertBefore(thumb, attachmentChipName);
    } else {
      // PDF: show document emoji
      attachmentChipIcon.hidden  = false;
      attachmentChipIcon.textContent = "📄";
    }

    attachmentPreview.hidden = false;
    attachBtn.classList.add("has-attachment");
  };

  reader.onerror = () => {
    showToast("Gagal membaca file. Silakan coba lagi.");
  };

  reader.readAsDataURL(file);
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGE RENDERING (extended for attachments)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build and inject a message row into the feed.
 * For user messages, optionally renders an attachment badge above the text.
 *
 * @param {"user"|"model"} role
 * @param {string} text
 * @param {object|null} [attachment]  { mimeType, data, fileName }
 * @returns {HTMLElement}
 */
function appendMessage(role, text, attachment = null) {
  hideEmptyState();

  const isUser = role === "user";
  const time   = formatTime(new Date());

  const row = document.createElement("div");
  row.className = `message-row ${role}`;
  row.setAttribute("role", "listitem");

  const avatar = document.createElement("div");
  avatar.className   = `avatar ${isUser ? "avatar-user" : "avatar-model"}`;
  avatar.textContent = isUser ? "K" : "✦";
  avatar.setAttribute("aria-hidden", "true");

  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isUser ? "bubble-user" : "bubble-model"}`;

  // ── Render attachment inside bubble (user messages only) ──────────────────
  if (isUser && attachment) {
    if (attachment.mimeType.startsWith("image/")) {
      // Render inline image thumbnail
      const img = document.createElement("img");
      img.className = "bubble-attachment-img";
      img.alt       = attachment.fileName || "Gambar terlampir";
      img.src       = `data:${attachment.mimeType};base64,${attachment.data}`;
      bubble.appendChild(img);
    } else {
      // Render a PDF/file badge row
      const badge = document.createElement("div");
      badge.className = "bubble-attachment";
      badge.innerHTML = `
        <span class="bubble-attachment-icon" aria-hidden="true">📄</span>
        <span class="bubble-attachment-name">${escapeHtml(attachment.fileName || "File terlampir")}</span>
      `;
      bubble.appendChild(badge);
    }
  }

  // Message text
  const textNode = document.createElement("span");
  textNode.innerHTML = escapeHtml(text);
  bubble.appendChild(textNode);

  const ts = document.createElement("time");
  ts.className   = "bubble-time";
  ts.textContent = time;
  ts.setAttribute("datetime", new Date().toISOString());

  wrap.append(bubble, ts);
  row.append(avatar, wrap);
  chatWindow.append(row);
  scrollToBottom();

  return row;
}

// ── Thinking Bubble ───────────────────────────────────────────────────────────
let thinkingRow = null;

function showThinkingBubble() {
  hideEmptyState();

  thinkingRow = document.createElement("div");
  thinkingRow.className = "message-row model";
  thinkingRow.setAttribute("aria-label", "Klin sedang memproses jawaban");

  const avatar = document.createElement("div");
  avatar.className   = "avatar avatar-model";
  avatar.textContent = "✦";
  avatar.setAttribute("aria-hidden", "true");

  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";

  const bubble = document.createElement("div");
  bubble.className = "bubble bubble-thinking";
  bubble.innerHTML = `
    <div class="thinking-dots" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
    Klin sedang berpikir...
  `;

  wrap.append(bubble);
  thinkingRow.append(avatar, wrap);
  chatWindow.append(thinkingRow);
  scrollToBottom();
}

function removeThinkingBubble() {
  if (thinkingRow) {
    thinkingRow.remove();
    thinkingRow = null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE: SEND MESSAGE  (extended with API key, model, and attachment)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Validate input, push to history, render user bubble, call /api/chat,
 * render model response or surface an error.
 *
 * @param {string} [overrideText]  Prompt from a chip or preset button click
 */
async function sendMessage(overrideText) {
  if (isLoading) return;

  const text = (overrideText ?? userInput.value).trim();
  if (!text && !pendingAttachment) return;

  // Capture current attachment and API settings before clearing state
  const attachmentToSend = pendingAttachment;
  const activeApiKey     = localStorage.getItem(LS_API_KEY) || "";
  const activeModel      = localStorage.getItem(LS_MODEL)   || "gemini-3.5-flash";


  // Clear composer state
  userInput.value = "";
  autoGrow();
  clearAttachment();

  // Push user turn to conversation state + render bubble
  const userText = text || `[Melampirkan: ${attachmentToSend?.fileName ?? "file"}]`;
  conversation.push({ role: "user", text: userText });
  appendMessage("user", userText, attachmentToSend);

  // Sidebar history entry
  addHistoryItem(userText);

  // Lock UI
  setComposerBusy(true);
  setStatus("thinking");
  showThinkingBubble();

  try {
    // Build request payload
    const payload = {
      conversation,
      ...(activeApiKey && { apiKey: activeApiKey }),
      model: activeModel,
      ...(attachmentToSend && { attachment: attachmentToSend }),
    };

    const response = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? `Server error ${response.status}`);
    }

    const reply = data.result ?? "";

    conversation.push({ role: "model", text: reply });
    removeThinkingBubble();
    appendMessage("model", reply);
    setStatus("idle");

  } catch (err) {
    removeThinkingBubble();
    setStatus("error");

    const msg = err.message?.includes("fetch")
      ? "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
      : err.message ?? "Terjadi kesalahan. Silakan coba lagi.";

    showToast(msg);
    appendMessage("model", `Maaf, permintaan ini tidak dapat diproses saat ini. ${msg}`);

    // Roll back the failed user turn
    conversation.pop();

    setTimeout(() => setStatus("idle"), 4000);

  } finally {
    setComposerBusy(false);
    userInput.focus();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═════════════════════════════════════════════════════════════════════════════

// ── Form submit ───────────────────────────────────────────────────────────────
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});

// ── Enter = send, Shift+Enter = newline ───────────────────────────────────────
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Auto-grow on input ────────────────────────────────────────────────────────
userInput.addEventListener("input", autoGrow);

// ── Sidebar ───────────────────────────────────────────────────────────────────
sidebarToggle.addEventListener("click", toggleSidebar);
sidebarBackdrop.addEventListener("click", () => setSidebarOpen(false));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Settings modal takes priority for Escape
    if (!settingsOverlay.hidden) {
      closeSettingsModal();
      return;
    }
    if (isMobileViewport() && isSidebarOpen) {
      setSidebarOpen(false);
    }
  }
});

// ── Chat reset ────────────────────────────────────────────────────────────────
resetBtn.addEventListener("click", resetChat);

// ── Toast manual close ────────────────────────────────────────────────────────
toastClose.addEventListener("click", hideToast);

// ── Settings modal ────────────────────────────────────────────────────────────
settingsBtn.addEventListener("click", openSettingsModal);
settingsCloseBtn.addEventListener("click", closeSettingsModal);
settingsCancelBtn.addEventListener("click", closeSettingsModal);
settingsSaveBtn.addEventListener("click", saveSettings);

// Close modal when clicking the backdrop overlay itself
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettingsModal();
});

// API Key show/hide toggle
apiKeyToggleBtn.addEventListener("click", toggleApiKeyVisibility);

// ── File attachment ───────────────────────────────────────────────────────────
// Clicking the paperclip button opens the hidden file input
attachBtn.addEventListener("click", () => fileInput.click());

// When a file is chosen, read it via FileReader
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) handleFileSelected(file);
});

// Remove button inside the preview chip
attachmentRemoveBtn.addEventListener("click", clearAttachment);

// Drag-and-drop onto the composer bezel as a quality-of-life shortcut
const composerBezel = document.querySelector(".composer-bezel");
if (composerBezel) {
  composerBezel.addEventListener("dragover", (e) => {
    e.preventDefault();
    composerBezel.style.borderColor = "var(--accent-primary)";
  });

  composerBezel.addEventListener("dragleave", () => {
    composerBezel.style.borderColor = "";
  });

  composerBezel.addEventListener("drop", (e) => {
    e.preventDefault();
    composerBezel.style.borderColor = "";
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelected(file);
  });
}

// ── Suggestion chips (empty state) ────────────────────────────────────────────
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

// ── Preset sidebar buttons ────────────────────────────────────────────────────
document.querySelectorAll(".preset-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prompt = btn.dataset.prompt;
    if (prompt) {
      if (isMobileViewport()) setSidebarOpen(false);
      sendMessage(prompt);
    }
  });
});

// ── Responsive: re-apply sidebar defaults on breakpoint crossing ──────────────
const breakpointQuery = window.matchMedia("(max-width: 1023px)");
breakpointQuery.addEventListener("change", (e) => {
  if (!e.matches) {
    sidebarBackdrop.style.display = "none";
    sidebarBackdrop.setAttribute("aria-hidden", "true");
    sidebar.classList.remove("collapsed");
    isSidebarOpen = true;
    sidebarToggle.setAttribute("aria-expanded", "true");
  } else {
    setSidebarOpen(false);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// INITIALISATION
// ═════════════════════════════════════════════════════════════════════════════
applyInitialSidebarState();
setStatus("idle");
userInput.focus();

// Pre-populate settings fields with any previously saved values
loadSettingsFromStorage();
