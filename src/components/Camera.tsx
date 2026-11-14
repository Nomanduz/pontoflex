import { useEffect, useRef, useState } from "react";
import { Camera as CamIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The saved 3x4 crop matches the preview; no upscaling, at most 960px wide. */
export function Camera({ onCapture, label, busy, allowUpload }: { onCapture: (img: string) => void; label: string; busy?: boolean; allowUpload?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [fotoErro, setFotoErro] = useState<string | null>(null);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let disposed = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((s) => {
        if (disposed) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => { if (!disposed) setErro("Não foi possível abrir a câmera. Verifique a permissão e feche outros aplicativos que a utilizem."); });
    if (!navigator.mediaDevices) setErro("Este navegador não permite usar a câmera.");
    return () => { disposed = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function salvar(source: CanvasImageSource, width: number, height: number) {
    const ratio = 3 / 4;
    const sw = Math.min(width, height * ratio);
    const sh = sw / ratio;
    const c = document.createElement("canvas");
    c.width = Math.min(960, Math.round(sw));
    c.height = Math.round(c.width / ratio);
    const ctx = c.getContext("2d");
    if (!ctx) { setFotoErro("Não foi possível preparar a foto. Tente novamente."); return; }
    ctx.drawImage(source, (width - sw) / 2, (height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    const result = c.toDataURL("image/jpeg", 0.92);
    if (result.length > 3_000_000) { setFotoErro("Foto muito grande. Envie uma imagem menor."); return; }
    setFotoErro(null);
    onCapture(result);
  }

  function capturar() {
    const v = video.current;
    if (busy || !ready || !v || v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
    salvar(v, v.videoWidth, v.videoHeight);
  }

  function enviarArquivo(file: File | undefined) {
    if (!file || busy) return;
    if (!file.type.startsWith("image/")) { setFotoErro("Selecione uma fotografia válida."); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      salvar(img, img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => { URL.revokeObjectURL(url); setFotoErro("Não foi possível abrir a foto. Tente um arquivo JPG ou PNG."); };
    img.src = url;
  }

  const upload = allowUpload && (
    <>
      <Button type="button" variant="outline" className="h-12 w-full" disabled={busy} onClick={() => uploadInput.current?.click()}><Upload className="size-4" /> Enviar foto 3x4</Button>
      <input ref={uploadInput} type="file" accept="image/*" aria-label="Foto de referência 3x4" className="hidden" disabled={busy} onChange={(e) => { enviarArquivo(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (erro) return <div className="space-y-3"><p role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{erro}</p>{upload}{fotoErro && <p role="alert" className="text-sm text-destructive">{fotoErro}</p>}</div>;
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg bg-muted">
        <video ref={video} autoPlay playsInline muted onLoadedData={() => setReady(true)} onPlaying={() => setReady(true)} onWaiting={() => setReady(false)} onEmptied={() => setReady(false)} className="aspect-[3/4] w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-[15%] rounded-[50%] border-4 border-accent/80" />
      </div>
      <Button type="button" size="lg" className="min-h-14 w-full whitespace-normal text-base font-bold" onClick={capturar} disabled={busy || !ready}>
        <CamIcon className="size-5" /> {busy ? "Verificando…" : !ready ? "Abrindo câmera…" : label}
      </Button>
      {upload}
      {fotoErro && <p role="alert" className="text-sm text-destructive">{fotoErro}</p>}
    </div>
  );
}
