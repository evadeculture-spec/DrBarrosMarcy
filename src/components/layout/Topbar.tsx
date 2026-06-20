"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Plus, Search, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { users } from "@/data/users";
import { useSession } from "@/hooks/useSession";
import { useUI } from "@/hooks/useUI";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { user, logout, switchUser } = useSession();
  const { openQuickCreate, setSearchOpen } = useUI();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-6">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-muted hover:bg-background lg:hidden"
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Pesquisa global */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted transition-colors hover:border-bordeaux/30 lg:max-w-md"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Pesquisar no escritório…</span>
        <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2 lg:ml-auto">
        <Button onClick={openQuickCreate} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" />
          Novo processo
        </Button>
        <Button
          onClick={openQuickCreate}
          size="icon"
          className="sm:hidden"
          aria-label="Novo processo"
        >
          <Plus className="h-5 w-5" />
        </Button>

        <button
          className="relative rounded-lg p-2 text-muted hover:bg-background"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>

        {/* Menu de utilizador */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="flex items-center gap-2 rounded-lg p-1 pl-2 hover:bg-background focus-ring"
          >
            {user && <Avatar userId={user.id} size="md" />}
          </button>
          {menuOpen && user && (
            <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-card-hover animate-scale-in">
              <div className="border-b border-border p-3">
                <p className="text-sm font-medium text-ink">{user.name}</p>
                <p className="text-xs text-muted">{user.email}</p>
              </div>
              <div className="p-1.5">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <UserCog className="mr-1 inline h-3 w-3" />
                  Mudar de utilizador
                </p>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onMouseDown={() => switchUser(u.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-background"
                  >
                    <Avatar userId={u.id} size="sm" />
                    {u.name}
                  </button>
                ))}
              </div>
              <div className="border-t border-border p-1.5">
                <button
                  onMouseDown={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-danger hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Terminar sessão
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
