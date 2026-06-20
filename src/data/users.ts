import type { Organization, User } from "@/types";
import { CURRENT_ORG_ID } from "@/lib/security";

export const organization: Organization = {
  id: CURRENT_ORG_ID,
  name: "Dr. Barros & Marcy — Solicitadoria",
  nif: "514 203 998",
  address: "Av. 1.º de Maio, 42, 2.º Esq.",
  city: "Castelo Branco",
  email: "geral@barrosmarcy.pt",
  phone: "+351 272 320 110",
};

export const users: User[] = [
  {
    id: "user-marcia",
    organizationId: CURRENT_ORG_ID,
    name: "Márcia Raposo",
    email: "marcia@barrosmarcy.pt",
    role: "admin",
    initials: "MR",
    color: "bg-bordeaux",
  },
  {
    id: "user-joao",
    organizationId: CURRENT_ORG_ID,
    name: "João Barros",
    email: "joao@barrosmarcy.pt",
    role: "solicitador",
    initials: "JB",
    color: "bg-indigo-600",
  },
  {
    id: "user-carolina",
    organizationId: CURRENT_ORG_ID,
    name: "Carolina",
    email: "carolina@barrosmarcy.pt",
    role: "assistente",
    initials: "CA",
    color: "bg-emerald-600",
  },
];

/** Utilizador "autenticado" no MVP (mock). */
export const CURRENT_USER_ID = "user-marcia";

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function userName(id: string): string {
  return getUser(id)?.name ?? "—";
}
