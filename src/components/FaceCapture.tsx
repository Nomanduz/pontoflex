import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CamIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarGuia, MENSAGENS, type Etapa, type Quadro } from "@/lib/face-guia";

/** Arquivos do MediaPipe servidos pelo próprio app (copiados por scripts/copiar-mediapipe.mjs). */
const WASM_URL = "/mediapipe/wasm";
const MODELO_URL = "/mediapipe/face_landmarker.task";

type Landmarker = {
  detectForVideo: (
    v: HTMLVideoElement,
    t: number,
  ) => {
    faceLandmarks: { x: number; y: number }[][];
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  };
  close: () => void;
};

let landmarkerPromise: Promise<Landmarker> | null = null;
function carregarLandmarker(): Promise<Landmarker> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const criar = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODELO_URL, delegate },
        runningMode: "VIDEO",
        numFaces: 2,
        outputFaceBlendshapes: true,
      });
    try {
      return (await criar("GPU")) as unknown as Landmarker;
    } catch {
      return (await criar("CPU")) as unknown as Landmarker;
    }
  })();
  landmarkerPromise.catch(() => {
    landmarkerPromise = null;
  });
  return landmarkerPromise;
}

/** Recorte 3:4 central do vídeo, o mesmo exibido na tela. */
function recorte(vw: number, vh: number) {
  const sw = Math.min(vw, vh * 0.75);
  const sh = sw / 0.75;
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}

function capturarQuadro(v: HTMLVideoElement): string | null {
  const { sx, sy, sw, sh } = recorte(v.videoWidth, v.videoHeight);
  const c = document.createElement("canvas");
  c.width = Math.min(720, Math.round(sw));
  c.height = Math.round(c.width / 0.75);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const img = c.toDataURL("image/jpeg", 0.9);
  return img.length > 3_000_000 ? null : img;
}

function quadroDe(
  v: HTMLVideoElement,
  r: ReturnType<Landmarker["detectForVideo"]>,
  t: number,
): Quadro {
  const rostos = r.faceLandmarks.length;
  if (rostos !== 1) return { t, rostos };
  const pts = r.faceLandmarks[0]!;
  const { sx, sy, sw, sh } = recorte(v.videoWidth, v.videoHeight);
  const nx = (x: number) => (x * v.videoWidth - sx) / sw;
  const ny = (y: number) => (y * v.videoHeight - sy) / sh;
  let minX = 1,
    maxX = 0,
    minY = 1,
    maxY = 0;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = nx((minX + maxX) / 2);
  const cy = ny((minY + maxY) / 2);
  const largura = nx(maxX) - nx(minX);
  const nariz = pts[1];
  const desvioNariz = nariz ? (nx(nariz.x) - cx) / (largura || 1) : undefined;
  const cat = r.faceBlendshapes?.[0]?.categories ?? [];
  const score = (n: string) => cat.find((c) => c.categoryName === n)?.score;
  return {
    t,
    rostos,
    cx,
    cy,
    largura,
    desvioNariz,
    piscadaEsq: score("eyeBlinkLeft"),
    piscadaDir: score("eyeBlinkRight"),
  };
}

const COR: Partial<Record<Etapa, string>> = {
  segure: "border-amber-400",
  pisque: "border-emerald-500",
  capturar: "border-emerald-500",
};

/**
 * Captura facial guiada: o usuário enquadra o rosto no oval e pisca; a foto é tirada sozinha
 * com os olhos abertos logo após a piscada. Se o detector não carregar (aparelho antigo),
 * mostra o botão de captura manual — a verificação no servidor continua valendo.
 */
export function FaceCapture({
  onCapture,
  busy,
  ativo = true,
  dica,
}: {
  onCapture: (img: string) => void;
  busy?: boolean;
  ativo?: boolean;
  dica?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [detector, setDetector] = useState<Landmarker | null>(null);
  const [semDetector, setSemDetector] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("sem_rosto");
  const guia = useRef(criarGuia());
  const capturaRef = useRef(onCapture);
  capturaRef.current = onCapture;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let disposed = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErroCamera("Este navegador não permite usar a câmera.");
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      .then((s) => {
        if (disposed) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => {
        if (!disposed)
          setErroCamera(
            "Não foi possível abrir a câmera. Verifique a permissão e feche outros aplicativos que a utilizem.",
          );
      });
    carregarLandmarker()
      .then((d) => {
        if (!disposed) setDetector(d);
      })
      .catch((e) => {
        console.error("face landmarker", e);
        if (!disposed) setSemDetector(true);
      });
    return () => {
      disposed = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Reinicia o guia quando a tela volta a ficar ativa (ex.: depois de um registro).
  useEffect(() => {
    if (ativo && !busy) {
      guia.current.reiniciar();
      setEtapa("sem_rosto");
    }
  }, [ativo, busy]);

  useEffect(() => {
    if (!detector || !pronto || !ativo || busy) return;
    let raf = 0;
    let ultimo = -1;
    const loop = () => {
      const v = video.current;
      if (v && v.readyState >= 2 && v.currentTime !== ultimo) {
        ultimo = v.currentTime;
        const t = performance.now();
        try {
          const e = guia.current.quadro(quadroDe(v, detector.detectForVideo(v, t), t));
          setEtapa(e);
          if (e === "capturar") {
            const img = capturarQuadro(v);
            if (img) capturaRef.current(img);
            else guia.current.reiniciar();
            return;
          }
        } catch (err) {
          console.error(err);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [detector, pronto, ativo, busy]);

  const manual = useCallback(() => {
    const v = video.current;
    if (!v || busy || v.readyState < 2) return;
    const img = capturarQuadro(v);
    if (img) onCapture(img);
  }, [busy, onCapture]);

  if (erroCamera)
    return (
      <p role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {erroCamera}
      </p>
    );

  const carregando = !pronto || (!detector && !semDetector);
  const mensagem = busy
    ? "Verificando…"
    : carregando
      ? "Preparando a câmera…"
      : semDetector
        ? "Olhe para a câmera e toque em capturar"
        : MENSAGENS[etapa];

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setPronto(true)}
          onPlaying={() => setPronto(true)}
          onEmptied={() => setPronto(false)}
          className="aspect-[3/4] w-full -scale-x-100 object-cover"
        />
        <div
          className={`pointer-events-none absolute left-[18%] right-[18%] top-[12%] bottom-[20%] rounded-[50%] border-4 transition-colors ${COR[etapa] ?? "border-white/70"}`}
        />
        <div
          aria-live="polite"
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 text-center text-lg font-semibold text-white"
        >
          {(busy || carregando) && <Loader2 className="mr-2 inline size-5 animate-spin" />}
          {mensagem}
        </div>
      </div>
      {dica && <p className="text-center text-sm text-muted-foreground">{dica}</p>}
      {semDetector && (
        <Button
          type="button"
          size="lg"
          className="min-h-14 w-full text-base font-bold"
          onClick={manual}
          disabled={busy || !pronto}
        >
          <CamIcon className="size-5" /> Capturar
        </Button>
      )}
    </div>
  );
}
