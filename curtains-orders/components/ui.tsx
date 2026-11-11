import type { Dict } from "@/lib/i18n/dictionaries";
import type { OrderStatus } from "@/lib/types";

const STATUS_STYLE: Record<OrderStatus, string> = {
  new: "bg-warn-soft text-warn",
  measuring: "bg-accent-soft text-accent",
  in_production: "bg-accent-soft text-accent",
  installation: "bg-accent-soft text-accent",
  completed: "bg-ok-soft text-ok",
  cancelled: "bg-canvas text-muted line-through",
};

export function StatusBadge({ status, t }: { status: OrderStatus; t: Dict }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[status]}`}
    >
      {t.statuses[status]}
    </span>
  );
}

export function Notice({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  const cls = kind === "error" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${cls}`}>
      {children}
    </p>
  );
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
