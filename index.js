// ─────────────────────────────────────────────────────────────────────────────
// index.js — Klin AI Chatbot Backend
// Stack : Express.js + @google/genai SDK (ESM)
// ─────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// ── ESM-safe __dirname ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Increased to 25mb to accommodate Base64-encoded image/PDF payloads.
app.use(express.json({ limit: "25mb" }));

app.use(express.static(path.join(__dirname, )));

// ── System Instruction ────────────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `
Kamu adalah asisten AI yang empatik, artikulatif, dan sopan bernama Klin.
Tugasmu adalah membantu pengguna dengan jelas, ramah, dan penuh perhatian.
Selalu berkomunikasi dalam Bahasa Indonesia yang natural dan mudah dipahami.
Jika pengguna tampak frustasi atau bingung, akui perasaan mereka terlebih dahulu
sebelum memberikan jawaban. Hindari jargon teknis yang tidak perlu; jika harus
menggunakannya, jelaskan artinya dengan sederhana.
`.trim();

// ── POST /api/chat ─────────────────────────────────────────────────────────────
// Accepts full conversation history + optional apiKey + optional attachment.
// attachment: { mimeType: string, data: string (base64, no prefix), fileName: string }
app.post("/api/chat", async (req, res) => {
  const { conversation, apiKey, attachment } = req.body;

  // ── Resolve API key: client-supplied key takes precedence over .env ────────
  const activeApiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!activeApiKey) {
    return res.status(400).json({
      error:
        "Tidak ada API Key yang tersedia. Silakan masukkan Google Gemini API Key di pengaturan.",
    });
  }

  // ── Input validation ───────────────────────────────────────────────────────
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return res.status(400).json({
      error: "Request body harus memiliki field 'conversation' berupa array yang tidak kosong.",
    });
  }

  const isValid = conversation.every(
    (turn) =>
      turn &&
      typeof turn === "object" &&
      (turn.role === "user" || turn.role === "model") &&
      typeof turn.text === "string"
  );

  if (!isValid) {
    return res.status(400).json({
      error: 'Setiap item dalam \'conversation\' harus memiliki \'role\' ("user"|"model") dan \'text\' (string).',
    });
  }

  // ── Instantiate GenAI with the active (possibly per-request) key ───────────
  const ai = new GoogleGenAI({ apiKey: activeApiKey });

  // ── Map conversation history to SDK content format ─────────────────────────
  // All turns except the last are mapped normally as plain text.
  // The last user turn may include an inlineData part for multimodal input.
  const lastTurn = conversation[conversation.length - 1];
  const historyTurns = conversation.slice(0, -1);

  const contents = historyTurns.map(({ role, text }) => ({
    role,
    parts: [{ text }],
  }));

  // Build the final user turn parts — always include the text.
  const lastParts = [{ text: lastTurn.text }];

  // If an attachment was provided, append an inlineData part for multimodal.
  if (
    attachment &&
    attachment.mimeType &&
    attachment.data &&
    lastTurn.role === "user"
  ) {
    lastParts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.data,
      },
    });
  }

  contents.push({ role: lastTurn.role, parts: lastParts });

  try {
    // ── Resolve model: use provided model name or fallback to default ──────
    const modelName = req.body.model || "gemini-3.5-flash";

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    return res.status(200).json({ result: response.text });
  } catch (err) {
    console.error("[Gemini API Error]", err?.message ?? err);

    const msg = err?.message ?? "";

    // 404 — model name is wrong or no longer available
    if (msg.includes("404") || msg.includes("NOT_FOUND") || msg.includes("no longer available")) {
      return res.status(422).json({
        error:
          "Model yang dipilih tidak tersedia atau sudah tidak berlaku. Buka Pengaturan dan pilih model lain (disarankan: gemini-3.5-flash).",
      });
    }

    // 503 — temporary overload / high demand
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
      return res.status(503).json({
        error:
          "Model sedang mengalami lonjakan permintaan. Tunggu beberapa detik lalu coba lagi, atau pilih model lain di Pengaturan.",
      });
    }

    // 429 — rate limit / quota exceeded
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      return res.status(429).json({
        error:
          "Kuota API Key habis atau terlalu banyak permintaan. Tunggu sebentar atau periksa kuota di Google AI Studio.",
      });
    }

    // 400/403 — bad key or no permission
    const isAuthError =
      msg.toLowerCase().includes("api key") ||
      msg.toLowerCase().includes("permission") ||
      msg.includes("400") ||
      msg.includes("403");

    return res.status(500).json({
      error: isAuthError
        ? "API Key tidak valid atau tidak memiliki izin. Periksa kembali API Key Anda di Pengaturan."
        : "Terjadi kesalahan pada server saat menghubungi Gemini API. Silakan coba lagi.",
    });
  }
});

// ── Fallback: serve index.html for any unmatched route ───────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Server berjalan di http://localhost:${PORT}`);
  console.log(`   Tekan Ctrl+C untuk menghentikan server.\n`);
});
