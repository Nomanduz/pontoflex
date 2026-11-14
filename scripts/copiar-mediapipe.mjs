// Copia o runtime WASM do MediaPipe e baixa o modelo de rosto para public/mediapipe,
// para o app servir tudo do próprio domínio (sem CDN de terceiros na hora do ponto).
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const destino = join("public", "mediapipe");
const wasmOrigem = join("node_modules", "@mediapipe", "tasks-vision", "wasm");
const MODELO =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

await mkdir(join(destino, "wasm"), { recursive: true });
for (const f of await readdir(wasmOrigem)) {
  if (f.startsWith("vision_wasm")) await copyFile(join(wasmOrigem, f), join(destino, "wasm", f));
}

const modelo = join(destino, "face_landmarker.task");
const existe = await stat(modelo)
  .then((s) => s.size > 1_000_000)
  .catch(() => false);
if (!existe) {
  const r = await fetch(MODELO);
  if (!r.ok) throw new Error(`Falha ao baixar o modelo facial: HTTP ${r.status}`);
  await writeFile(modelo, Buffer.from(await r.arrayBuffer()));
}
console.log("MediaPipe pronto em public/mediapipe");
