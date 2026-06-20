"use client";

import { SessionProvider } from "@/hooks/useSession";
import { StoreProvider } from "@/hooks/useStore";
import { UIProvider } from "@/hooks/useUI";

/**
 * Agrupa os providers de contexto da app (sessão mock, store em memória e
 * estado de UI). Em produção, o StoreProvider dá lugar a um cliente de dados
 * (React Query + Supabase) e o SessionProvider à autenticação real.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <StoreProvider>
        <UIProvider>{children}</UIProvider>
      </StoreProvider>
    </SessionProvider>
  );
}
