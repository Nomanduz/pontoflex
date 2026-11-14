import { Checkbox } from "@/components/ui/checkbox";

export const TEXTO_CONSENTIMENTO =
  "Autorizo o uso da minha imagem facial exclusivamente para o registro de ponto nesta empresa (LGPD, art. 11). " +
  "As fotos ficam guardadas de forma privada e posso pedir a exclusão ao RH quando deixar de usar o sistema.";

export function Consentimento({
  checked,
  onChange,
  id = "consentimento",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-snug"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span>{TEXTO_CONSENTIMENTO}</span>
    </label>
  );
}
