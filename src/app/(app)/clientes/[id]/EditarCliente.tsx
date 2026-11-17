"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormCliente } from "../FormCliente";

export function EditarCliente({ cliente }: { cliente: { id: string; name: string; email: string | null; phone: string | null; nif: string | null; city: string | null; address: string | null; notes: string | null } }) {
  const [aEditar, setAEditar] = useState(false);
  if (!aEditar) {
    return (
      <Button variant="outline" className="mt-4 h-11 w-full" onClick={() => setAEditar(true)}>
        Editar dados do cliente
      </Button>
    );
  }
  return (
    <div className="mt-4 border-t border-border pt-4">
      <FormCliente
        id={cliente.id}
        inicial={{
          nome: cliente.name, email: cliente.email ?? "", telefone: cliente.phone ?? "", nif: cliente.nif ?? "",
          localidade: cliente.city ?? "", morada: cliente.address ?? "", notas: cliente.notes ?? "",
        }}
        aoGuardar={() => setAEditar(false)}
        aoCancelar={() => setAEditar(false)}
      />
    </div>
  );
}
