export const digits = (v: string) => v.replace(/\D/g, "");

export function maskCnpj(v: string): string {
  const d = digits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCpf(v: string): string {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Internal login identifiers; these addresses never receive email. */
export const empresaEmail = (cnpj: string) => `empresa-${digits(cnpj)}@pontoflex.app`;
export const funcionarioEmail = (cpf: string) => `func-${digits(cpf)}@pontoflex.app`;
