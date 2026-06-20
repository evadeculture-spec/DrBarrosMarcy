import { Badge } from "@/components/ui/badge";
import { PRIORITIES } from "@/lib/constants";
import type { Priority } from "@/types";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITIES[priority];
  return (
    <Badge className={meta.badge} dot={meta.dot}>
      {meta.label}
    </Badge>
  );
}
