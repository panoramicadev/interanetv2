/**
 * Mensajes de voz del chat del Panel de Trabajo.
 *
 * Un audio grabado en el chat se guarda en el mismo storage que el resto de
 * los archivos subidos (Supabase en producción, Replit o disco local como
 * respaldo, igual que /api/upload) y se transcribe con OpenAI para que el
 * mensaje quede como texto en la bitácora: se lee de un vistazo, se busca y el
 * asistente IA lo toma como contexto. Si la transcripción falla, el mensaje
 * igual se publica con el audio y un marcador en el texto.
 */
import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { toFile } from "openai";
import { createSupabase } from "./supabase-client";
import { ObjectStorageService } from "./objectStorage";
import { getOpenAI } from "./ai-agent";

/** Texto que lleva el mensaje cuando no se pudo transcribir el audio. */
export const AUDIO_SIN_TRANSCRIPCION = "🎤 Mensaje de voz";

/** Tope de duración que se acepta (el cliente también lo corta ahí). */
export const AUDIO_MAX_SEGUNDOS = 180;

// Extensión según el formato que entrega MediaRecorder: Chrome/Android graba
// webm (opus), Safari/iOS graba mp4 (aac).
function extensionParaMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return ".m4a";
  if (m.includes("ogg")) return ".ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return ".mp3";
  if (m.includes("wav")) return ".wav";
  return ".webm";
}

/** Sube el audio y devuelve su URL pública (misma lógica de storage que /api/upload). */
export async function guardarAudioChat(buffer: Buffer, mimetype: string): Promise<string> {
  const fileName = `chat-audio-${Date.now()}-${nanoid(8)}${extensionParaMime(mimetype)}`;
  const contentType = mimetype || "audio/webm";

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_STORAGE_BUCKET) {
    const supabase = await createSupabase(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(`uploads/${fileName}`, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    const { data } = supabase.storage.from(bucket).getPublicUrl(`uploads/${fileName}`);
    return data.publicUrl;
  }

  if (process.env.PUBLIC_OBJECT_SEARCH_PATHS) {
    return new ObjectStorageService().uploadImage(fileName, buffer, contentType);
  }

  const uploadsDir = path.join(process.cwd(), "server", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
  return `/api/uploads/${fileName}`;
}

/**
 * Transcribe el audio en español. Devuelve null si el modelo no responde o
 * no entiende nada: el que llama decide qué texto poner en su lugar.
 */
export async function transcribirAudioChat(buffer: Buffer, mimetype: string): Promise<string | null> {
  try {
    const openai = getOpenAI();
    const file = await toFile(buffer, `audio${extensionParaMime(mimetype)}`, { type: mimetype || "audio/webm" });
    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "es",
      // Le da vocabulario del rubro para que no invente nombres raros.
      prompt: "Mensaje de voz de un vendedor de Pinturas Panorámica sobre un cliente, cotización, NVV, despacho o cobranza.",
    });
    const texto = (result.text || "").trim();
    return texto.length > 0 ? texto : null;
  } catch (err: any) {
    console.error("[CHAT-AUDIO] No se pudo transcribir:", err?.message || err);
    return null;
  }
}
