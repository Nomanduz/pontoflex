/** Prepara arquivos no navegador antes do envio: fotos são reduzidas e viram JPEG. */
export const MAX_ENVIO_BYTES = 3_000_000;

function lerComoDataUrl(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Não foi possível ler o arquivo"));
    r.readAsDataURL(file);
  });
}

async function reduzirImagem(file: File, maxLado: number, qualidade: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Imagem inválida"));
      i.src = url;
    });
    const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", qualidade);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto (qualquer formato de imagem) ou PDF, pronto para enviar ao servidor. */
export async function prepararDocumento(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_ENVIO_BYTES) throw new Error("PDF muito grande (máximo 3 MB)");
    return lerComoDataUrl(file);
  }
  if (!file.type.startsWith("image/")) throw new Error("Envie uma foto ou um PDF");
  const dataUrl = await reduzirImagem(file, 1600, 0.85);
  if (dataUrl.length * 0.75 > MAX_ENVIO_BYTES) throw new Error("Foto muito grande");
  return dataUrl;
}

/** Foto de perfil quadrada pequena. */
export async function prepararFotoPerfil(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem");
  return reduzirImagem(file, 480, 0.85);
}
