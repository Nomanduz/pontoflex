import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Foto de perfil (arquivo privado: o link assinado vale 10 minutos). */
export function FotoPerfil({
  path,
  nome,
  className,
}: {
  path: string | null | undefined;
  nome: string;
  className?: string;
}) {
  const { data: url } = useQuery({
    queryKey: ["foto-perfil", path],
    enabled: !!path,
    staleTime: 8 * 60_000,
    queryFn: async () =>
      (await supabase.storage.from("perfil").createSignedUrl(path!, 600)).data?.signedUrl ?? null,
  });
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <Avatar className={cn("size-10", className)}>
      {url && <AvatarImage src={url} alt={`Foto de ${nome}`} className="object-cover" />}
      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
        {iniciais}
      </AvatarFallback>
    </Avatar>
  );
}
