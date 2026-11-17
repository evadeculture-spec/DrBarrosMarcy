"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAvisos } from "@/components/avisos";
import { criarClienteAcao, editarClienteAcao } from "./acoes";

export interface ValoresCliente {
  nome: string;
  email: string;
  telefone: string;
  nif: string;
  localidade: string;
  morada: string;
  notas: string;
}

export function FormCliente({
  id,
  inicial,
  aoGuardar,
  aoCancelar,
}: {
  id?: string;
  inicial: ValoresCliente;
  aoGuardar?: () => void;
  aoCancelar?: () => void;
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [v, setV] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = (k: keyof ValoresCliente) => ({
    id: `cf-${k}`,
    value: v[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value }),
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        iniciar(async () => {
          const r = id ? await editarClienteAcao(id, { ...v }) : await criarClienteAcao({ ...v });
          if (!r.ok) {
            setErro(r.erro);
            return;
          }
          avisar({ tipo: "sucesso", texto: id ? "Cliente atualizado." : "Cliente criado." });
          if (aoGuardar) aoGuardar();
          else if (!id && r.dados) router.push(`/clientes/${(r.dados as { id: string }).id}`);
          router.refresh();
        });
      }}
    >
      <div className="sm:col-span-2">
        <Label htmlFor="cf-nome">Nome</Label>
        <Input {...campo("nome")} required autoComplete="off" />
      </div>
      <div>
        <Label htmlFor="cf-email">Email</Label>
        <Input {...campo("email")} type="email" autoComplete="off" />
      </div>
      <div>
        <Label htmlFor="cf-telefone">Telefone</Label>
        <Input {...campo("telefone")} type="tel" autoComplete="off" />
      </div>
      <div>
        <Label htmlFor="cf-nif">NIF</Label>
        <Input {...campo("nif")} inputMode="numeric" maxLength={9} autoComplete="off" aria-describedby="cf-nif-ajuda" />
        <p id="cf-nif-ajuda" className="mt-1 text-xs text-muted">9 algarismos. Opcional.</p>
      </div>
      <div>
        <Label htmlFor="cf-localidade">Localidade</Label>
        <Input {...campo("localidade")} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="cf-morada">Morada</Label>
        <Input {...campo("morada")} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="cf-notas">Notas</Label>
        <Textarea {...campo("notas")} rows={3} />
      </div>
      {erro && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 sm:col-span-2">{erro}</p>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        {aoCancelar && <Button type="button" variant="ghost" onClick={aoCancelar}>Cancelar</Button>}
        <Button type="submit" disabled={pendente}>{pendente ? "A guardar…" : id ? "Guardar alterações" : "Criar cliente"}</Button>
      </div>
    </form>
  );
}
