// Somente servidor: reconhecimento facial com AWS Rekognition.
// Cada empresa tem a sua coleção; o rosto de referência é indexado após aprovação do administrador.
import {
  CreateCollectionCommand,
  DeleteCollectionCommand,
  DeleteFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

/** Similaridade mínima (0–100) para aceitar a identificação. Padrão 95. */
export const SIMILARIDADE_MIN = Math.min(
  99.9,
  Math.max(80, Number(process.env["FACE_SIMILARIDADE_MIN"] ?? 95)),
);

export class FaceErro extends Error {
  constructor(
    public codigo: "sem_rosto" | "qualidade" | "varios_rostos" | "indisponivel",
    mensagem: string,
  ) {
    super(mensagem);
  }
}

let _client: RekognitionClient | undefined;
function client() {
  if (!process.env["AWS_ACCESS_KEY_ID"] || !process.env["AWS_SECRET_ACCESS_KEY"]) {
    throw new FaceErro(
      "indisponivel",
      "Reconhecimento facial não configurado (AWS). Avise o administrador.",
    );
  }
  _client ??= new RekognitionClient({ region: process.env["AWS_REGION"] ?? "us-east-1" });
  return _client;
}

export const colecaoDa = (empresaId: string) => `pontoflex-${empresaId}`;

function erroDeServico(e: unknown): never {
  if (e instanceof FaceErro) throw e;
  const nome = (e as { name?: string })?.name ?? "";
  if (nome === "InvalidParameterException")
    throw new FaceErro(
      "sem_rosto",
      "Nenhum rosto encontrado na imagem. Centralize o rosto e tente novamente.",
    );
  if (nome === "ImageTooLargeException" || nome === "InvalidImageFormatException")
    throw new FaceErro("qualidade", "Imagem inválida. Tente novamente.");
  if (nome === "ProvisionedThroughputExceededException" || nome === "ThrottlingException")
    throw new FaceErro(
      "indisponivel",
      "Muitas verificações ao mesmo tempo. Aguarde alguns segundos.",
    );
  console.error("rekognition", nome, (e as Error)?.message);
  throw new FaceErro(
    "indisponivel",
    "Serviço de reconhecimento facial indisponível. O ponto não foi registrado.",
  );
}

async function garantirColecao(empresaId: string) {
  try {
    await client().send(new CreateCollectionCommand({ CollectionId: colecaoDa(empresaId) }));
  } catch (e) {
    if ((e as { name?: string })?.name !== "ResourceAlreadyExistsException") erroDeServico(e);
  }
}

const MOTIVOS: Record<string, string> = {
  EXCEEDS_MAX_FACES: "Apenas uma pessoa deve aparecer na foto.",
  LOW_BRIGHTNESS: "A foto está escura. Procure um lugar mais iluminado.",
  LOW_SHARPNESS: "A foto ficou tremida ou desfocada. Fique parado e tente de novo.",
  LOW_CONFIDENCE: "O rosto não ficou nítido. Olhe para a câmera, sem óculos escuros ou boné.",
  SMALL_BOUNDING_BOX: "O rosto ficou pequeno. Aproxime-se da câmera.",
  EXTREME_POSE: "Olhe de frente para a câmera.",
  LOW_FACE_QUALITY: "A qualidade do rosto ficou baixa. Tente com mais luz.",
};

/** Indexa o rosto de referência. Exige exatamente um rosto com boa qualidade. */
export async function indexarRosto(
  empresaId: string,
  funcionarioId: string,
  imagem: Uint8Array,
): Promise<string> {
  await garantirColecao(empresaId);
  try {
    const r = await client().send(
      new IndexFacesCommand({
        CollectionId: colecaoDa(empresaId),
        Image: { Bytes: imagem },
        ExternalImageId: funcionarioId,
        MaxFaces: 1,
        QualityFilter: "HIGH",
        DetectionAttributes: ["DEFAULT"],
      }),
    );
    const motivos = (r.UnindexedFaces ?? []).flatMap((u) => u.Reasons ?? []);
    if (motivos.includes("EXCEEDS_MAX_FACES")) {
      const extras = r.FaceRecords?.map((f) => f.Face?.FaceId).filter(Boolean) as
        string[] | undefined;
      if (extras?.length) await removerRosto(empresaId, extras);
      throw new FaceErro("varios_rostos", MOTIVOS["EXCEEDS_MAX_FACES"]!);
    }
    const faceId = r.FaceRecords?.[0]?.Face?.FaceId;
    if (!faceId)
      throw new FaceErro(
        "qualidade",
        MOTIVOS[motivos[0] ?? ""] ?? "Não encontramos um rosto nítido na foto. Tente novamente.",
      );
    return faceId;
  } catch (e) {
    erroDeServico(e);
  }
}

/** Procura o rosto entre os funcionários aprovados da empresa (1 chamada, qualquer quantidade de funcionários). */
export async function buscarRosto(
  empresaId: string,
  imagem: Uint8Array,
): Promise<{ funcionarioId: string; similaridade: number } | null> {
  try {
    const r = await client().send(
      new SearchFacesByImageCommand({
        CollectionId: colecaoDa(empresaId),
        Image: { Bytes: imagem },
        MaxFaces: 1,
        FaceMatchThreshold: SIMILARIDADE_MIN,
        QualityFilter: "AUTO",
      }),
    );
    const m = r.FaceMatches?.[0];
    if (!m?.Face?.ExternalImageId || m.Similarity == null) return null;
    return { funcionarioId: m.Face.ExternalImageId, similaridade: m.Similarity };
  } catch (e) {
    if ((e as { name?: string })?.name === "ResourceNotFoundException") return null;
    erroDeServico(e);
  }
}

export async function removerRosto(empresaId: string, faceIds: string[]) {
  if (!faceIds.length) return;
  try {
    await client().send(
      new DeleteFacesCommand({ CollectionId: colecaoDa(empresaId), FaceIds: faceIds }),
    );
  } catch (e) {
    if ((e as { name?: string })?.name !== "ResourceNotFoundException") erroDeServico(e);
  }
}

export async function removerColecao(empresaId: string) {
  try {
    await client().send(new DeleteCollectionCommand({ CollectionId: colecaoDa(empresaId) }));
  } catch (e) {
    if ((e as { name?: string })?.name !== "ResourceNotFoundException") erroDeServico(e);
  }
}

// ---------- Utilitários de imagem ----------

export function validarImagem(img: unknown): string {
  if (typeof img !== "string" || !img.startsWith("data:image/jpeg;base64,"))
    throw new Error("Foto inválida");
  if (img.length > 3_000_000) throw new Error("Foto muito grande");
  return img;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  return new Uint8Array(Buffer.from(dataUrl.split(",")[1] ?? "", "base64"));
}

export function bytesToDataUrl(bytes: Uint8Array, mime = "image/jpeg"): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
