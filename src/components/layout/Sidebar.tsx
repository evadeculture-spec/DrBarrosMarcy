"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckSquare,
  FileSpreadsheet,
  FileWarning,
  LayoutDashboard,
  Mail,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/processos", label: "Processos", icon: FileSpreadsheet },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare },
  { href: "/documentos", label: "Documentos em falta", icon: FileWarning },
  { href: "/templates", label: "Templates", icon: Mail },
  { href: "/importar", label: "Importar", icon: FileSpreadsheet },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay para mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" onClick={onClose}>
            <Logo />
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-background lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring",
                  active
                    ? "bg-bordeaux text-white shadow-sm"
                    : "text-ink/80 hover:bg-bordeaux/[0.06] hover:text-bordeaux",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <p className="text-xs font-medium text-ink">
            Dr. Barros &amp; Marcy
          </p>
          <p className="text-xs text-muted">Castelo Branco · MVP</p>
        </div>
      </aside>
    </>
  );
}
