/**
 * Guia de captura facial (estilo totem): enquadrar o rosto no oval → piscar → captura automática.
 * Função pura, alimentada a cada quadro com o resultado do detector (MediaPipe Face Landmarker).
 * Coordenadas já normalizadas para a área visível (recorte 3:4), de 0 a 1.
 */
export type Etapa =
  | "sem_rosto"
  | "varios_rostos"
  | "aproxime"
  | "afaste"
  | "centralize"
  | "olhe_frente"
  | "segure"
  | "pisque"
  | "capturar";

export interface Quadro {
  /** Momento do quadro em ms. */
  t: number;
  rostos: number;
  /** Centro e largura do rosto (0–1 na área visível). */
  cx?: number | undefined;
  cy?: number | undefined;
  largura?: number | undefined;
  /** Desvio horizontal do nariz em relação ao centro do rosto, proporcional à largura. */
  desvioNariz?: number | undefined;
  /** Pontuação de olho fechado (0 = aberto, 1 = fechado). */
  piscadaEsq?: number | undefined;
  piscadaDir?: number | undefined;
}

export const MENSAGENS: Record<Etapa, string> = {
  sem_rosto: "Posicione seu rosto dentro do oval",
  varios_rostos: "Apenas uma pessoa por vez",
  aproxime: "Aproxime-se da câmera",
  afaste: "Afaste-se um pouco",
  centralize: "Centralize o rosto no oval",
  olhe_frente: "Olhe de frente para a câmera",
  segure: "Isso! Fique parado…",
  pisque: "Agora pisque os olhos",
  capturar: "Pronto!",
};

export const LIMITES = {
  larguraMin: 0.38,
  larguraMax: 0.85,
  desvioCentroX: 0.14,
  centroY: 0.46,
  desvioCentroY: 0.16,
  desvioNariz: 0.12,
  /** Tempo enquadrado antes de pedir a piscada. */
  segurarMs: 400,
  fechado: 0.45,
  aberto: 0.25,
  /** Uma piscada real dura entre ~60 ms e ~800 ms. */
  piscadaMaxMs: 900,
};

export function criarGuia() {
  let enquadradoDesde: number | null = null;
  let viuAberto = false;
  let fechouEm: number | null = null;
  let capturado = false;

  function reiniciar() {
    enquadradoDesde = null;
    viuAberto = false;
    fechouEm = null;
  }

  function enquadramento(q: Quadro): Etapa | null {
    if (q.rostos === 0 || q.cx == null || q.cy == null || q.largura == null) return "sem_rosto";
    if (q.rostos > 1) return "varios_rostos";
    if (q.largura < LIMITES.larguraMin) return "aproxime";
    if (q.largura > LIMITES.larguraMax) return "afaste";
    if (
      Math.abs(q.cx - 0.5) > LIMITES.desvioCentroX ||
      Math.abs(q.cy - LIMITES.centroY) > LIMITES.desvioCentroY
    )
      return "centralize";
    if (q.desvioNariz != null && Math.abs(q.desvioNariz) > LIMITES.desvioNariz)
      return "olhe_frente";
    return null;
  }

  return {
    /** Processa um quadro e devolve a etapa atual. "capturar" é devolvido uma única vez. */
    quadro(q: Quadro): Etapa {
      if (capturado) return "capturar";
      const problema = enquadramento(q);
      if (problema) {
        reiniciar();
        return problema;
      }
      enquadradoDesde ??= q.t;
      if (q.t - enquadradoDesde < LIMITES.segurarMs) return "segure";

      const fechado = Math.min(q.piscadaEsq ?? 0, q.piscadaDir ?? 0);
      const aberto = Math.max(q.piscadaEsq ?? 1, q.piscadaDir ?? 1);
      if (fechouEm == null) {
        if (aberto < LIMITES.aberto) viuAberto = true;
        else if (viuAberto && fechado > LIMITES.fechado) fechouEm = q.t;
        return "pisque";
      }
      // Olhos fechados: espera reabrir; fechado tempo demais não conta como piscada.
      if (q.t - fechouEm > LIMITES.piscadaMaxMs) {
        fechouEm = null;
        viuAberto = false;
        return "pisque";
      }
      if (aberto < LIMITES.aberto) {
        capturado = true;
        return "capturar";
      }
      return "pisque";
    },
    reiniciar() {
      reiniciar();
      capturado = false;
    },
  };
}
