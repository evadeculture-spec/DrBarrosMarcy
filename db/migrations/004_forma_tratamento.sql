-- Forma de tratamento escolhida para cada utilizador (rótulos como
-- «Solicitador»/«Solicitadora»). Opcional: sem valor, o rótulo é neutro.
alter table users add column forma_tratamento text
  check (forma_tratamento in ('masculino', 'feminino'));
