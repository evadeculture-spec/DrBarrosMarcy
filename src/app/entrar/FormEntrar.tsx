"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { entrarAcao, type EstadoEntrar } from "./acoes";

function Submeter() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "A entrar…" : "Entrar"}
    </Button>
  );
}

export function FormEntrar() {
  const [estado, acao] = useFormState<EstadoEntrar, FormData>(entrarAcao, {});
  return (
    <form action={acao} className="mt-6 space-y-4" noValidate>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={estado.email} autoFocus />
      </div>
      <div>
        <Label htmlFor="palavraPasse">Palavra-passe</Label>
        <Input id="palavraPasse" name="palavraPasse" type="password" autoComplete="current-password" required />
      </div>
      {estado.erro && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {estado.erro}
        </p>
      )}
      <Submeter />
    </form>
  );
}
