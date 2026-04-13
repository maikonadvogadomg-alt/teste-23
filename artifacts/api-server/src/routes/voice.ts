import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { Readable } from "stream";

const router = Router();

function getOpenAI(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("AI Integrations OpenAI nÃ£o configurado");
  return new OpenAI({ baseURL, apiKey });
}

// ââ POST /api/voice/transcribe âââââââââââââââââââââââââââââââââââââââââââââ
// Body: { audio: string (base64), mimeType?: string }
// Returns: { transcript: string }
router.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audio, mimeType = "audio/webm" } = req.body;
    if (!audio) { res.status(400).json({ error: "Campo 'audio' (base64) obrigatÃ³rio" }); return; }

    const openai = getOpenAI();
    const buffer = Buffer.from(audio, "base64");

    // Cria um File-like object a partir do buffer
    const ext = mimeType.includes("mp4") ? "m4a"
              : mimeType.includes("ogg")  ? "ogg"
              : mimeType.includes("wav")  ? "wav"
              : "webm";

    const file = new File([buffer], `audio.${ext}`, { type: mimeType });

    const transcription = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
      language: "pt",
      response_format: "text",
    });

    const transcript = typeof transcription === "string"
      ? transcription.trim()
      : (transcription as any).text?.trim() ?? "";

    res.json({ transcript });
  } catch (err: any) {
    console.error("[voice/transcribe]", err?.message);
    res.status(500).json({ error: err?.message ?? "Erro na transcriÃ§Ã£o" });
  }
});

// ââ POST /api/voice/speak ââââââââââââââââââââââââââââââââââââââââââââââââââ
// Body: { text: string, voice?: string }
// Returns: { audio: string (base64 MP3) }
router.post("/speak", async (req: Request, res: Response) => {
  try {
    const { text, voice = "nova", speedPrompt = "Fale em velocidade normal." } = req.body;
    if (!text) { res.status(400).json({ error: "Campo 'text' obrigatÃ³rio" }); return; }

    const openai = getOpenAI();

    const systemInstruction = `VocÃª Ã© uma voz natural e expressiva em portuguÃªs brasileiro. Leia o texto a seguir exatamente como estÃ¡, sem adicionar nada. ${speedPrompt}`;

    // Usa gpt-audio com entrada de texto puro para gerar Ã¡udio
    const completion = await (openai.chat.completions as any).create({
      model: "gpt-audio-mini",
      modalities: ["text", "audio"],
      audio: { voice, format: "mp3" },
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: text },
      ],
    });

    const audioData: string | undefined = completion.choices?.[0]?.message?.audio?.data;
    const transcript: string = completion.choices?.[0]?.message?.audio?.transcript ?? text;

    if (!audioData) {
      res.status(500).json({ error: "Modelo nÃ£o retornou Ã¡udio" }); return;
    }

    res.json({ audio: audioData, transcript });
  } catch (err: any) {
    console.error("[voice/speak]", err?.message);
    res.status(500).json({ error: err?.message ?? "Erro na sÃ­ntese de voz" });
  }
});

export default router;
