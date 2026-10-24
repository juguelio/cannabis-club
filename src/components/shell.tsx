"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Panel", icon: "▤" },
  { href: "/socios", label: "Socios", icon: "👤" },
  { href: "/stock", label: "Stock", icon: "🌿" },
  { href: "/dispensario", label: "Dispensario", icon: "⚖" },
  { href: "/reportes", label: "Reportes", icon: "🗂" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Shell({
  clubName,
  userName,
  userRole,
  clubConfigured,
  children,
}: {
  clubName: string;
  userName: string;
  userRole: string;
  clubConfigured: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">🌿</div>
          <div>
            <div className="brand-name">{clubName}</div>
            <div className="brand-sub">Asociación de cultivo</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link" data-active={isActive(path, item.href)}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          {!clubConfigured ? (
            <p className="mb-3 text-[11.5px] leading-snug" style={{ color: "var(--warn)" }}>
              Faltan datos del club (CUIT, director médico, responsable técnico).
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div style={{ fontWeight: 600 }}>{userName}</div>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>{userRole}</div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button className="btn btn-secondary btn-sm" type="submit">
                Salir
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div>
        <div className="page">{children}</div>
        <nav className="mobile-nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} data-active={isActive(path, item.href)}>
              <div style={{ fontSize: 16 }}>{item.icon}</div>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
