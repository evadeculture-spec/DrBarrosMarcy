"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  CalendarClock,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { userName } from "@/data/users";
import { useStore } from "@/hooks/useStore";
import { useSession } from "@/hooks/useSession";
import { formatDateTime } from "@/utils/date";
import type { TimelineEvent, TimelineEventType } from "@/types";

const ICONS: Record<TimelineEventType, typeof Mail> = {
  nota: MessageSquare,
  chamada: Phone,
  email: Mail,
  documento: FileText,
  estado: ArrowRightLeft,
  prazo: CalendarClock,
};

const COLORS: Record<TimelineEventType, string> = {
  nota: "bg-bordeaux/10 text-bordeaux",
  chamada: "bg-indigo-50 text-indigo-600",
  email: "bg-cyan-50 text-cyan-600",
  documento: "bg-blue-50 text-blue-600",
  estado: "bg-purple-50 text-purple-600",
  prazo: "bg-amber-50 text-warning",
};

export function Timeline({
  matterId,
  events,
}: {
  matterId: string;
  events: TimelineEvent[];
}) {
  const { addNote } = useStore();
  const { user } = useSession();
  const [note, setNote] = useState("");

  const submit = () => {
    const text = note.trim();
    if (!text || !user) return;
    addNote(matterId, user.id, `${user.name} adicionou nota: ${text}`);
    setNote("");
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-border bg-surface p-3">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Adicionar nota interna ao histórico…"
          className="min-h-[64px] border-0 p-1 shadow-none focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={!note.trim()}>
            <Send className="h-4 w-4" />
            Adicionar nota
          </Button>
        </div>
      </div>

      <ol className="relative space-y-5 border-l border-border pl-6">
        {events.map((event) => {
          const Icon = ICONS[event.type];
          return (
            <li key={event.id} className="relative">
              <span
                className={`absolute -left-[34px] inline-flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background ${COLORS[event.type]}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-sm text-ink">{event.message}</p>
                <p className="mt-1 text-xs text-muted">
                  {userName(event.authorId)} · {formatDateTime(event.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
