import { Badge } from "@/components/ui/badge";
import {
  CHECKLIST_STATUS,
  MATTER_STATUS,
  PAYMENT_STATUS,
  TASK_STATUS,
} from "@/lib/constants";
import type {
  ChecklistStatus,
  DocumentStatus,
  MatterStatus,
  PaymentStatus,
  TaskStatus,
} from "@/types";

export function StatusBadge({ status }: { status: MatterStatus }) {
  const meta = MATTER_STATUS[status];
  return (
    <Badge className={meta.badge} dot={meta.dot}>
      {meta.label}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS[status];
  return (
    <Badge className={meta.badge} dot={meta.dot}>
      {meta.label}
    </Badge>
  );
}

export function DocStatusBadge({
  status,
}: {
  status: ChecklistStatus | DocumentStatus;
}) {
  const meta = CHECKLIST_STATUS[status];
  return (
    <Badge className={meta.badge} dot={meta.dot}>
      {meta.label}
    </Badge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS[status];
  return <Badge className={meta.badge}>{meta.label}</Badge>;
}
