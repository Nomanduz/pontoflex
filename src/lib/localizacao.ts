/** Localização do aparelho com cache curto, para o registro não esperar o GPS a cada toque. */
let ultima: { lat: number; lng: number; em: number } | null = null;

export function obterLocalizacao(maxIdadeMs = 120_000): Promise<{ lat: number; lng: number }> {
  if (ultima && Date.now() - ultima.em < maxIdadeMs) return Promise.resolve(ultima);
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Este aparelho não informa a localização."));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        ultima = { lat: p.coords.latitude, lng: p.coords.longitude, em: Date.now() };
        res(ultima);
      },
      () => rej(new Error("Ative a localização do aparelho para registrar o ponto.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    );
  });
}

/** Mantém a localização atualizada em segundo plano (terminal fixo). Retorna a função para parar. */
export function acompanharLocalizacao(): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(
    (p) => {
      ultima = { lat: p.coords.latitude, lng: p.coords.longitude, em: Date.now() };
    },
    () => {},
    { enableHighAccuracy: true, maximumAge: 60_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
