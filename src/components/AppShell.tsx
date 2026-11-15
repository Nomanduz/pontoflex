import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/Brand";
import { GuardaSessao } from "@/components/GuardaSessao";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";
import type { Papel } from "@/lib/session";

export function AppShell({
  papel,
  links,
  children,
}: {
  papel: Papel;
  links: { to: string; label: string }[];
  children: ReactNode;
}) {
  const signOut = useSignOut();
  return (
    <div className="min-h-screen bg-background">
      <GuardaSessao papel={papel} />
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Brand className="text-primary" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <LogOut className="size-4" /> Sair
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair do PontoFlex?</AlertDialogTitle>
                <AlertDialogDescription>
                  Para entrar de novo será preciso digitar a senha.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continuar aqui</AlertDialogCancel>
                <AlertDialogAction onClick={() => void signOut()}>Sair</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">{children}</main>
    </div>
  );
}
