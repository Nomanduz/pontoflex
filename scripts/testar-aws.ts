// Confere se as chaves da AWS no .env funcionam e têm as permissões do PontoFlex.
// Uso: bun run testar-aws   (não exibe as chaves)
import {
  CreateCollectionCommand,
  DeleteCollectionCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";

const id = process.env["AWS_ACCESS_KEY_ID"];
const segredo = process.env["AWS_SECRET_ACCESS_KEY"];
const regiao = process.env["AWS_REGION"] ?? "us-east-2";
if (!id || !segredo) {
  console.error("✗ AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY estão vazios no .env.");
  process.exit(1);
}
if (!id.startsWith("AKIA")) console.warn("! A Access key normalmente começa com AKIA. Confira se não trocou os campos.");

const client = new RekognitionClient({ region: regiao });
const colecao = `pontoflex-teste-${Date.now()}`;
const dicas: Record<string, string> = {
  UnrecognizedClientException: "a Access key não existe (copiada errada ou apagada).",
  InvalidSignatureException: "a Secret key não confere com a Access key.",
  AccessDeniedException: "o usuário existe, mas falta anexar a política PontoFlexRekognition.",
};

try {
  await client.send(new CreateCollectionCommand({ CollectionId: colecao }));
  await client.send(new DeleteCollectionCommand({ CollectionId: colecao }));
  console.log(`✓ AWS ok: chaves válidas e Rekognition liberado na região ${regiao}.`);
} catch (e) {
  const nome = (e as { name?: string }).name ?? "Erro";
  console.error(`✗ ${nome}: ${dicas[nome] ?? (e as Error).message}`);
  process.exitCode = 1;
}
