// Transcripción de voz dentro del equipo (Whisper con transformers.js).
// El modelo se descarga una vez con señal y queda guardado en el navegador.
import { pipeline, env } from "./vendor/transformers.min.js";

env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.wasmPaths = new URL("./vendor/", self.location.href).href;
env.backends.onnx.wasm.numThreads = 1;

const CANDIDATES = {
  base: ["onnx-community/whisper-base", "Xenova/whisper-base"],
  tiny: ["onnx-community/whisper-tiny", "Xenova/whisper-tiny"],
};
let asr = null, loadedKey = null;

async function load(size) {
  if (asr && loadedKey === size) return asr;
  let lastErr = null;
  for (const id of CANDIDATES[size] || CANDIDATES.base) {
    try {
      asr = await pipeline("automatic-speech-recognition", id, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p) => postMessage({ type: "progress", p }),
      });
      loadedKey = size;
      postMessage({ type: "model", id });
      return asr;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("No se pudo cargar el modelo");
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "load") {
      await load(m.size);
      postMessage({ type: "ready", size: m.size });
    } else if (m.type === "run") {
      const a = await load(m.size);
      const out = await a(m.audio, { language: "spanish", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
      postMessage({ type: "done", id: m.id, text: String((out && out.text) || "").trim() });
    }
  } catch (err) {
    postMessage({ type: "error", id: m.id, msg: String((err && err.message) || err) });
  }
};
