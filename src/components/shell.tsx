"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Panel", icon: "▤" },
  { href: "/socios", label: "Socios", icon: "♙" },
  { href: "/turnos", label: "Turnos", icon: "◷" },
  { href: "/stock", label: "Stock", icon: "♧" },
  { href: "/dispensario", label: "Dispensario", icon: "⚖" },
  { href: "/reportes", label: "Reportes", icon: "🗂" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function MemberShell({
  clubName,
  userName,
  children,
}: {
  clubName: string;
  userName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="member-shell">
      <header
        className="member-header"
        style={{ background: "var(--brand)", color: "#ecfdf5" }}
      >
        <div className="flex items-center gap-2">
          <span className="member-brand-mark" aria-hidden="true">♧</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{clubName}</div>
            <div style={{ fontSize: 11, color: "#a7d7bb" }}>Portal del socio · {userName}</div>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="btn btn-sm" style={{ background: "rgba(255,255,255,.14)", borderColor: "rgba(255,255,255,.2)" }}>
            Salir
          </button>
        </form>
      </header>
      <main className="member-main">
        {children}
      </main>
    </div>
  );
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
  const navigation = userRole === "ADMIN" ? [...NAV, { href: "/configuracion", label: "Configuración", icon: "⚙" }] : NAV;
  return (
    <div className="shell">
      <a className="skip-link" href="#contenido">Ir al contenido</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">♧</div>
          <div>
            <div className="brand-name">{clubName}</div>
            <div className="brand-sub">Asociación de cultivo</div>
          </div>
        </div>

        <div className="nav-caption">ESPACIO DE GESTIÓN</div>
        <nav aria-label="Navegación principal" className="flex flex-col gap-1">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link" data-active={isActive(path, item.href)} aria-current={isActive(path, item.href) ? "page" : undefined}>
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
        <header className="workspace-bar"><span>Tu club, en orden.</span><Link href="/socios/nuevo" className="workspace-action">＋ Nuevo socio</Link></header>
        <main id="contenido" className="page">{children}</main>
        <nav aria-label="Navegación móvil" className="mobile-nav" style={{ gridTemplateColumns: `repeat(${navigation.length}, minmax(0, 1fr))` }}>
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} data-active={isActive(path, item.href)} aria-current={isActive(path, item.href) ? "page" : undefined}>
              <div style={{ fontSize: 16 }}>{item.icon}</div>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
