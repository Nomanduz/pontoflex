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

/** Máscara de digitação que aceita CPF (11) ou CNPJ (14). */
export function maskDocumento(v: string): string {
  return digits(v).length <= 11 ? maskCpf(v) : maskCnpj(v);
}

/** CPF exibido sem expor o número inteiro (LGPD): ***.456.789-** */
export function cpfParcial(cpf: string): string {
  const d = digits(cpf);
  if (d.length !== 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function cpfValido(v: string): boolean {
  const d = digits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function cnpjValido(v: string): boolean {
  const d = digits(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (len: number) => {
    const pesos =
      len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

export type TipoDocumento = "CPF" | "CNPJ";

/** Valida e normaliza o documento da empresa (CPF ou CNPJ). */
export function documentoEmpresa(v: string): { tipo: TipoDocumento; documento: string } {
  const d = digits(v ?? "");
  if (d.length === 11 && cpfValido(d)) return { tipo: "CPF", documento: maskCpf(d) };
  if (d.length === 14 && cnpjValido(d)) return { tipo: "CNPJ", documento: maskCnpj(d) };
  throw new Error("Informe um CPF ou CNPJ válido");
}

/** Internal login identifiers; these addresses never receive email. */
export const empresaEmail = (documento: string) => `empresa-${digits(documento)}@pontoflex.app`;
/** Funcionário: único por empresa (o mesmo CPF pode trabalhar em duas empresas). */
export const funcionarioEmail = (empresaId: string, cpf: string) =>
  `func-${empresaId.replace(/-/g, "").slice(0, 12)}-${digits(cpf)}@pontoflex.app`;
