/**
 * Notas de segurança e RGPD — SolicitaFlow (MVP)
 * ================================================
 *
 * Este MVP usa dados mock em estado local. Antes de ir para produção com
 * dados reais de clientes, é OBRIGATÓRIO reforçar os pontos abaixo. Cada
 * comentário "// SECURITY:" no código marca um ponto a endurecer.
 *
 * 1. AUTENTICAÇÃO
 *    - Substituir o mock login (`useSession`) por Supabase Auth ou Clerk.
 *    - Sessões com expiração, refresh tokens e logout em todos os dispositivos.
 *
 * 2. MULTI-TENANT / SEPARAÇÃO POR ESCRITÓRIO
 *    - Todas as entidades têm `organizationId`. Em produção, filtrar SEMPRE
 *      as queries por organização do utilizador autenticado.
 *    - Ativar Supabase Row Level Security (RLS):
 *        create policy "org_isolation" on matters
 *        using (organization_id = auth.jwt() ->> 'org_id');
 *
 * 3. PERMISSÕES POR UTILIZADOR (RBAC)
 *    - Papéis: admin, solicitador, assistente (ver `UserRole`).
 *    - Validar permissões no servidor, nunca apenas no cliente.
 *
 * 4. LOGS DE ATIVIDADE / AUDITORIA
 *    - Registar acessos e alterações a dados pessoais (quem, o quê, quando).
 *    - A timeline de cada processo é a base para isto.
 *
 * 5. DADOS SENSÍVEIS (RGPD)
 *    - NIF, morada e documentos de identificação são dados pessoais.
 *    - Não expor em logs, URLs ou respostas desnecessárias.
 *    - Documentos em Supabase Storage com buckets privados + URLs assinadas.
 *    - Política de retenção e direito ao esquecimento.
 *
 * 6. TRANSPORTE E ARMAZENAMENTO
 *    - HTTPS obrigatório (garantido pela Vercel).
 *    - Encriptação em repouso dos documentos.
 */

/** Organização "ativa" do MVP. Em produção vem do JWT/sessão do utilizador. */
export const CURRENT_ORG_ID = "org-dbm";

/**
 * Placeholder de verificação de permissões. Em produção, mover para o
 * servidor e validar contra o papel do utilizador autenticado.
 */
export function can(role: string, action: "manage_settings" | "delete"): boolean {
  // SECURITY: verificação meramente ilustrativa no MVP.
  if (action === "manage_settings") return role === "admin";
  return role === "admin" || role === "solicitador";
}
