import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: ({ context }) => {
    if (context.papel === "superadmin") throw redirect({ to: "/nomanduz" });
    if (context.papel !== "admin") throw redirect({ to: "/ponto" });
  },
  component: () => (
    <AppShell
      links={[
        { to: "/admin", label: "Dashboard" },
        { to: "/admin/funcionarios", label: "Funcionários" },
        { to: "/admin/registros", label: "Registros" },
        { to: "/admin/ajustes", label: "Ajustes" },
        { to: "/admin/fechamento", label: "Fechamento" },
        { to: "/admin/terminal", label: "Terminal" },
        { to: "/admin/senha", label: "Senha" },
      ]}
    >
      <Outlet />
    </AppShell>
  ),
});
