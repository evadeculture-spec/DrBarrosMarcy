import { redirect } from "next/navigation";
import { sessaoAtual } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  redirect((await sessaoAtual()) ? "/dashboard" : "/entrar");
}
