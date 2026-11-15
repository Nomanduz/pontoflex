/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export interface Cerca {
  latitude: number | string | null;
  longitude: number | string | null;
  raio_m: number | null;
}

/** Maior margem de erro do GPS descontada da distância (acima disso a leitura não é confiável). */
export const PRECISAO_MAX_M = 100;

/**
 * Confere a marcação contra a cerca da empresa. Sem cerca configurada, tudo é permitido.
 * O GPS de celular em ambiente fechado erra dezenas de metros: a margem de erro informada pelo
 * aparelho (limitada a PRECISAO_MAX_M) é descontada para não barrar quem está no local.
 */
export function avaliarCerca(
  cerca: Cerca,
  lat: number,
  lon: number,
  precisao = 0,
): { distancia_m: number | null; fora: boolean } {
  if (cerca.latitude == null || cerca.longitude == null || !cerca.raio_m)
    return { distancia_m: null, fora: false };
  const d = distanciaM(Number(cerca.latitude), Number(cerca.longitude), lat, lon);
  const margem = Number.isFinite(precisao) ? Math.min(Math.max(precisao, 0), PRECISAO_MAX_M) : 0;
  return { distancia_m: d, fora: d - margem > cerca.raio_m };
}

export function coordenadasValidas(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}
