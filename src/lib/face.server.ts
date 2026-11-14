import { GatewayError, streamResponse } from "@lovable.dev/ai-gateway";
import { z } from "zod";

// AI photo comparison, not a trained biometric engine or certified liveness check.
const MODEL = "openai/gpt-6-astra";

export interface FaceResult {
  rosto_real: boolean;
  mesma_pessoa: boolean;
  confianca: number;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["rosto_real", "mesma_pessoa", "confianca"],
  properties: {
    rosto_real: { type: "boolean", description: "A selfie mostra um rosto humano real e ao vivo (não foto de tela/papel)." },
    mesma_pessoa: { type: "boolean" },
    confianca: { type: "number", description: "0 a 1" },
  },
};

const faceResultSchema = z.object({ rosto_real: z.boolean(), mesma_pessoa: z.boolean(), confianca: z.number().min(0).max(1) });

export async function compararRostos(referencia: string, selfie: string): Promise<FaceResult> {
  try {
    const stream = await streamResponse({
      model: MODEL,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "verificacao_facial", strict: true, schema } },
      input: [
        {
          role: "system",
          content:
            "Você verifica identidade para registro de ponto. Compare o rosto da FOTO DE REFERÊNCIA com o da SELFIE. Seja rigoroso: mesma_pessoa só é true se for claramente a mesma pessoa. rosto_real é false se não houver rosto, houver várias pessoas, ou parecer foto de outra tela/papel.",
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: "FOTO DE REFERÊNCIA:" },
            { type: "input_image", image_url: referencia, detail: "high" },
            { type: "input_text", text: "SELFIE AGORA:" },
            { type: "input_image", image_url: selfie, detail: "high" },
          ],
        },
      ],
    });
    let text = "";
    let completed = false;
    for await (const ev of stream) {
      if (ev.type === "response.output_text.delta") text += ev.delta;
      if (ev.type === "response.refusal.delta" || ev.type === "response.refusal.done") throw new Error("A IA não pôde realizar a comparação facial. O ponto não foi registrado.");
      if (ev.type === "response.incomplete") throw new Error("A verificação facial não foi concluída. O ponto não foi registrado.");
      if (ev.type === "response.completed") completed = true;
    }
    if (!completed) throw new Error("A verificação facial foi interrompida. O ponto não foi registrado.");
    return faceResultSchema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("face gateway", { code: error.code, httpStatus: error.httpStatus, outcome: error.outcome, recovery: error.recovery, ids: error.ids });
      if (error.code === "payment_required") throw new Error("Reconhecimento facial indisponível: a empresa precisa repor os créditos de IA.");
      if (error.code === "permission_denied") throw new Error("O serviço de reconhecimento facial está sem permissão de acesso. Procure o administrador.");
      if (error.code === "rate_limited") throw new Error("Muitas verificações ao mesmo tempo. Aguarde antes de tentar novamente.");
      throw new Error("O serviço de reconhecimento facial está indisponível. O ponto não foi registrado.");
    }
    if (error instanceof SyntaxError || error instanceof z.ZodError) throw new Error("O serviço retornou uma verificação inválida. O ponto não foi registrado.");
    throw error;
  }
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToDataUrl(bytes: Uint8Array, mime = "image/jpeg"): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function sha256(text: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
