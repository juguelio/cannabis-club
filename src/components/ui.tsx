import type { Tone } from "@/lib/labels";

export function Chip({ tone = "mute", children }: { tone?: Tone; children: React.ReactNode }) {
  const cls = tone === "mute" ? "chip" : `chip chip-${tone}`;
  return <span className={cls}>{children}</span>;
}

export function PageHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle ? <p className="section-sub">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Meter({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const t = tone ?? (pct >= 100 ? "danger" : pct >= 80 ? "warn" : "ok");
  return (
    <div className="meter" data-tone={t === "ok" ? undefined : t}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-[13.5px]">{value}</div>
    </div>
  );
}
