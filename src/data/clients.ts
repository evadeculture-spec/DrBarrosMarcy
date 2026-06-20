import type { Client } from "@/types";
import { CURRENT_ORG_ID } from "@/lib/security";

const org = CURRENT_ORG_ID;

export const clients: Client[] = [
  {
    id: "cli-karolina",
    organizationId: org,
    name: "Karolina Jasinska-Sadowska",
    kind: "particular",
    email: "k.jasinska@gmail.com",
    phone: "+351 912 445 781",
    address: "Rua do Saibreiro, 18, Castelo Branco",
    nif: "291 884 552",
    country: "Polónia",
    notes: "Cidadã polaca a residir em Portugal. Comunica em inglês.",
    createdAt: "2026-05-28",
  },
  {
    id: "cli-bodin",
    organizationId: org,
    name: "Família Bodin",
    kind: "particular",
    email: "pierre.bodin@orange.fr",
    phone: "+33 6 12 88 04 19",
    address: "Quinta da Carapalha, Castelo Branco",
    nif: "245 110 663",
    country: "França",
    notes: "Herança de imóvel rústico. Vários herdeiros, alguns em França.",
    createdAt: "2026-04-12",
  },
  {
    id: "cli-silva",
    organizationId: org,
    name: "António Silva Marques",
    kind: "particular",
    email: "antonio.marques@sapo.pt",
    phone: "+351 966 201 334",
    address: "Rua de Santa Maria, 7, Idanha-a-Nova",
    nif: "178 552 901",
    country: "Portugal",
    createdAt: "2026-03-02",
  },
  {
    id: "cli-thompson",
    organizationId: org,
    name: "James Thompson",
    kind: "particular",
    email: "james.thompson@outlook.com",
    phone: "+44 7700 900128",
    address: "12 Maple Street, Manchester, Reino Unido",
    nif: "302 991 447",
    country: "Reino Unido",
    notes: "Reside no Reino Unido. Necessita de procuração para representação.",
    createdAt: "2026-05-15",
  },
  {
    id: "cli-hortas",
    organizationId: org,
    name: "Hortas do Tejo, Lda.",
    kind: "empresa",
    email: "geral@hortasdotejo.pt",
    phone: "+351 272 988 540",
    address: "Zona Industrial, Lote 14, Vila Velha de Ródão",
    nif: "509 778 210",
    country: "Portugal",
    notes: "Empresa agrícola. Vários prédios rústicos.",
    createdAt: "2026-02-20",
  },
  {
    id: "cli-pereira",
    organizationId: org,
    name: "Maria de Lurdes Pereira",
    kind: "particular",
    email: "lurdes.pereira58@gmail.com",
    phone: "+351 933 770 215",
    address: "Largo da Sé, 3, Castelo Branco",
    nif: "201 663 884",
    country: "Portugal",
    createdAt: "2026-06-01",
  },
  {
    id: "cli-novak",
    organizationId: org,
    name: "Tomáš Novák",
    kind: "particular",
    email: "tomas.novak@email.cz",
    phone: "+420 605 112 904",
    address: "Praha 4, República Checa",
    nif: "—",
    country: "República Checa",
    notes: "Pedido de NIF para aquisição de imóvel.",
    createdAt: "2026-06-10",
  },
  {
    id: "cli-fonseca",
    organizationId: org,
    name: "Rui Fonseca",
    kind: "particular",
    email: "rui.fonseca@gmail.com",
    phone: "+351 925 008 471",
    address: "Rua do Comércio, 55, Fundão",
    nif: "199 220 781",
    country: "Portugal",
    createdAt: "2026-01-18",
  },
];

export function getClient(id: string): Client | undefined {
  return clients.find((c) => c.id === id);
}

export function clientName(id: string): string {
  return getClient(id)?.name ?? "Cliente desconhecido";
}
