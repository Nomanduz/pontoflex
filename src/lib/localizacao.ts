/** Localização do aparelho com cache curto, para o registro não esperar o GPS a cada toque. */
export type Posicao = {
  lat: number;
  lng: number;
  /** Margem de erro do GPS em metros. */
  precisao: number;
};
let ultima: (Posicao & { em: number }) | null = null;

function guardar(p: GeolocationPosition) {
  const nova = {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    precisao: Math.round(p.coords.accuracy || 0),
    em: Date.now(),
  };
  // Mantém a leitura mais precisa enquanto ela for recente (até 15 s).
  if (!ultima || nova.precisao <= ultima.precisao || nova.em - ultima.em > 15_000) ultima = nova;
  return ultima;
}

export function obterLocalizacao(maxIdadeMs = 120_000): Promise<Posicao> {
  if (ultima && Date.now() - ultima.em < maxIdadeMs) return Promise.resolve(ultima);
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Este aparelho não informa a localização."));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        res(
          maxIdadeMs
            ? guardar(p)
            : {
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                precisao: Math.round(p.coords.accuracy || 0),
              },
        ),
      () => rej(new Error("Ative a localização do aparelho para registrar o ponto.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: maxIdadeMs ? 60_000 : 0 },
    );
  });
}

/** Mantém a localização atualizada em segundo plano (terminal fixo). Retorna a função para parar. */
export function acompanharLocalizacao(): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) return () => {};
  const id = navigator.geolocation.watchPosition(guardar, () => {}, {
    enableHighAccuracy: true,
    maximumAge: 60_000,
  });
  return () => navigator.geolocation.clearWatch(id);
}
