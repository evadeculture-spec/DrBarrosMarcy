"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickCreateProcessModal } from "@/components/QuickCreateProcessModal";
import { useSession } from "@/hooks/useSession";
import { useUI } from "@/hooks/useUI";

/**
 * Shell autenticado: sidebar + topbar + conteúdo. Protege as rotas internas
 * redirecionando para a página inicial quando não há sessão.
 *
 * SECURITY: esta proteção é apenas no cliente (MVP). Em produção, validar a
 * sessão no servidor (middleware Next.js + Supabase Auth).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useSession();
  const { quickCreateOpen, closeQuickCreate } = useUI();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <GlobalSearch />
      <QuickCreateProcessModal
        open={quickCreateOpen}
        onClose={closeQuickCreate}
      />
    </div>
  );
}
