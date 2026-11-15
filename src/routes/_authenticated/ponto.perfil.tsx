import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { FotoPerfil } from "@/components/FotoPerfil";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeuFuncionario } from "@/hooks/use-meu-funcionario";
import { prepararFotoPerfil } from "@/lib/arquivo";
import { cpfParcial } from "@/lib/doc";
import { ESCALAS } from "@/lib/escala";
import { atualizarMeuPerfil, enviarFotoPerfil } from "@/lib/perfil.functions";
import { terminoPrevisto, TIPOS_CONTRATO, type TipoContrato } from "@/lib/vinculo";

export const Route = createFileRoute("/_authenticated/ponto/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — PontoFlex" }] }),
  component: MeuPerfil,
});

const br = (k: string | null | undefined) => (k ? k.split("-").reverse().join("/") : "—");

const CAMPOS = [
  "telefone",
  "email_contato",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "emergencia_nome",
  "emergencia_parentesco",
  "emergencia_telefone",
] as const;
type Form = Record<(typeof CAMPOS)[number], string>;

function Linha({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

function MeuPerfil() {
  const qc = useQueryClient();
  const { data } = useMeuFuncionario();
  const salvarPerfil = useServerFn(atualizarMeuPerfil);
  const salvarFoto = useServerFn(enviarFotoPerfil);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  const f = data?.f;

  useEffect(() => {
    if (f && !form)
      setForm(Object.fromEntries(CAMPOS.map((c) => [c, (f[c] as string | null) ?? ""])) as Form);
  }, [f, form]);

  if (!f || !form) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await salvarPerfil({ data: form! });
      toast.success("Dados atualizados");
      qc.invalidateQueries({ queryKey: ["meu-cadastro"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function trocarFoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await salvarFoto({ data: { imagem: await prepararFotoPerfil(file) } });
      toast.success("Foto atualizada");
      qc.invalidateQueries({ queryKey: ["meu-cadastro"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar a foto");
    } finally {
      setBusy(false);
    }
  }

  const campo = (k: keyof Form, label: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={k}>{label}</Label>
      <Input
        id={k}
        value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        {...extra}
      />
    </div>
  );
  const termino = terminoPrevisto(f);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="relative">
            <FotoPerfil path={f.foto_perfil_path} nome={f.nome} className="size-20 text-xl" />
            <button
              type="button"
              aria-label="Trocar foto de perfil"
              className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground"
              onClick={() => arquivo.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
            <input
              ref={arquivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => trocarFoto(e.target.files?.[0])}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold leading-tight">{f.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {f.cargo || "Cargo não informado"}
              {f.departamento ? ` · ${f.departamento}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">Matrícula {f.matricula}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base">Dados contratuais</CardTitle>
        </CardHeader>
        <CardContent>
          <Linha k="Empresa" v={data.emp?.razao_social ?? "—"} />
          <Linha k="CPF" v={<span className="font-mono">{cpfParcial(f.cpf)}</span>} />
          <Linha k="Admissão" v={br(f.data_admissao)} />
          <Linha
            k="Contrato"
            v={TIPOS_CONTRATO[f.tipo_contrato as TipoContrato] ?? f.tipo_contrato}
          />
          {termino && <Linha k="Término previsto" v={br(termino)} />}
          <Linha
            k="Jornada"
            v={`${ESCALAS[f.escala]?.label ?? f.escala} · ${f.hora_entrada.slice(0, 5)} às ${f.hora_saida.slice(0, 5)}`}
          />
          <p className="pt-2 text-xs text-muted-foreground">
            Algum dado contratual errado? Fale com o RH da empresa.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={salvar} className="space-y-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Contato e endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {campo("telefone", "Celular", { inputMode: "tel" })}
            {campo("email_contato", "E-mail", { type: "email" })}
            {campo("cep", "CEP", { inputMode: "numeric", maxLength: 9 })}
            <div className="sm:col-span-2">{campo("logradouro", "Rua / avenida")}</div>
            {campo("numero", "Número")}
            {campo("complemento", "Complemento")}
            {campo("bairro", "Bairro")}
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              {campo("cidade", "Cidade")}
              {campo("uf", "UF", { maxLength: 2, className: "uppercase" })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Contato de emergência</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {campo("emergencia_nome", "Nome")}
            {campo("emergencia_parentesco", "Parentesco")}
            {campo("emergencia_telefone", "Telefone", { inputMode: "tel" })}
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Usado só se algo acontecer com você durante o trabalho. Avise essa pessoa de que o
              número dela está aqui.
            </p>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Salvar meus dados
        </Button>
      </form>

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm">
          <p className="flex items-start gap-2 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Seus dados são vistos apenas por você e pelo RH da empresa, para cumprir o contrato de
            trabalho (LGPD). Você pode corrigi-los aqui a qualquer momento.
          </p>
          <Button variant="outline" asChild>
            <Link to="/ponto/conta">
              <KeyRound className="size-4" /> Trocar minha senha
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
