import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import type { Tone } from "@/lib/labels";

export function Chip({ tone = "mute", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={tone === "mute" ? "chip" : `chip chip-${tone}`}>{children}</span>;
}

export function PageHead({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {back ? (
          <Link className="crumb" href={back.href}>
            <ArrowLeft aria-hidden /> {back.label}
          </Link>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  id,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={`panel ${className}`} id={id}>
      {title ? (
        <div className="panel-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="panel-title">{title}</h2>
            {subtitle ? <p className="panel-sub">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Compatibilidad con pantallas que todavía usan el nombre anterior. */
export const Section = Panel;

export function Empty({ icon: Icon, title, children, action }: { icon?: LucideIcon; title?: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      {Icon ? <Icon aria-hidden /> : null}
      {title ? <b>{title}</b> : null}
      {children ? <div>{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Meter({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const t = tone ?? (pct >= 100 ? "danger" : pct >= 80 ? "warn" : "ok");
  return (
    <div className="meter" data-tone={t === "ok" ? undefined : t} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Note({ tone, icon: Icon, children }: { tone?: "warn" | "danger" | "ok"; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div className={`note ${tone ? `note-${tone}` : ""}`} role={tone === "danger" ? "alert" : undefined}>
      {Icon ? <Icon aria-hidden /> : null}
      <div>{children}</div>
    </div>
  );
}

export function initials(first: string, last: string) {
  return `${(first.trim()[0] ?? "").toUpperCase()}${(last.trim()[0] ?? "").toUpperCase()}`;
}

export function Avatar({ first, last, tone, size }: { first: string; last: string; tone?: Tone; size?: "lg" }) {
  return (
    <span className={`avatar ${size === "lg" ? "avatar-lg" : ""}`} data-tone={tone} aria-hidden>
      {initials(first, last)}
    </span>
  );
}

export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
