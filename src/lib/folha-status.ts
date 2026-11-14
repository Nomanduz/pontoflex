export function statusFolha(f: {
  func_assinado_em: string | null;
  empresa_assinado_em: string | null;
}) {
  if (f.empresa_assinado_em) return { label: "Assinada por ambos", variant: "default" as const };
  if (f.func_assinado_em) return { label: "Aguardando empresa", variant: "secondary" as const };
  return { label: "Aguardando funcionário", variant: "outline" as const };
}
