"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  CalendarClock, FileSpreadsheet, LayoutDashboard, LogOut, Menu, Scale, Search, Settings, Sprout, TriangleAlert, Users, X,
} from "lucide-react";
import { CommandPalette, useOpenPalette } from "./command-palette";
import { ToastProvider } from "./toast";

type NavItem = { href: string; label: string; icon: React.ElementType; count?: number };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

const monogram = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "CC";

const ROLE: Record<string, string> = { ADMIN: "Administración", OPERADOR: "Mostrador" };

export function Shell(props: {
  clubName: string;
  userName: string;
  userRole: string;
  clubConfigured: boolean;
  pendingPickups: number;
  todayAppointments: number;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <CommandPalette isAdmin={props.userRole === "ADMIN"}>
        <ShellInner {...props} />
      </CommandPalette>
    </ToastProvider>
  );
}

function ShellInner({ clubName, userName, userRole, clubConfigured, pendingPickups, todayAppointments, children }: Parameters<typeof Shell>[0]) {
  const path = usePathname();
  const openPalette = useOpenPalette();
  const [drawer, setDrawer] = useState(false);
  // La navegación cierra el cajón en móvil.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setDrawer(false); }

  const mac = useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );

  const daily: NavItem[] = [
    { href: "/", label: "Panel", icon: LayoutDashboard },
    { href: "/dispensario", label: "Dispensario", icon: Scale, count: pendingPickups },
    { href: "/turnos", label: "Turnos", icon: CalendarClock, count: todayAppointments },
    { href: "/calendario", label: "Calendario", icon: CalendarClock },
  ];
  const club: NavItem[] = [
    { href: "/socios", label: "Socios", icon: Users },
    { href: "/stock", label: "Stock y lotes", icon: Sprout },
    { href: "/control", label: "Control", icon: Sprout },
    { href: "/cierre-mensual", label: "Cierre mensual", icon: FileSpreadsheet },
    { href: "/reportes", label: "Libros", icon: FileSpreadsheet },
  ];
  const admin: NavItem[] =
    userRole === "ADMIN"
      ? [
          { href: "/inspeccion", label: "Modo inspección", icon: FileSpreadsheet },
          { href: "/configuracion", label: "Configuración", icon: Settings },
        ]
      : [];

  const link = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <Link key={item.href} href={item.href} className="rail-link" aria-current={isActive(path, item.href) ? "page" : undefined}>
        <Icon aria-hidden />
        {item.label}
        {item.count ? <span className="rail-count" aria-label={`${item.count} pendientes`}>{item.count}</span> : null}
      </Link>
    );
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido">Ir al contenido</a>
      {drawer ? <div className="rail-scrim" onClick={() => setDrawer(false)} aria-hidden /> : null}
      <aside className="rail" data-open={drawer} aria-label="Navegación principal">
        <div className="flex items-start justify-between">
          <Link href="/" className="rail-brand">
            <span className="monogram" aria-hidden>{monogram(clubName)}</span>
            <span style={{ minWidth: 0 }}>
              <span className="rail-club" style={{ display: "block" }}>{clubName}</span>
              <span className="rail-sub" style={{ display: "block" }}>Asociación de cultivo</span>
            </span>
          </Link>
          {drawer ? (
            <button className="icon-btn" style={{ color: "#c9d9cf" }} onClick={() => setDrawer(false)} aria-label="Cerrar menú"><X /></button>
          ) : null}
        </div>
        <nav className="flex flex-col gap-0.5">
          <div className="rail-group">Día a día</div>
          {daily.map(link)}
          <div className="rail-group">Club</div>
          {club.map(link)}
          {admin.length ? <div className="rail-group">Administración</div> : null}
          {admin.map(link)}
        </nav>
        {!clubConfigured ? (
          <Link href={userRole === "ADMIN" ? "/configuracion" : "/"} className="rail-warn">
            <TriangleAlert aria-hidden style={{ width: 15, height: 15, display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
            Faltan datos legales del club: CUIT, director médico y responsable técnico.
          </Link>
        ) : null}
        <div className="rail-foot">
          <div className="rail-user">
            <b>{userName}</b>
            <span>{ROLE[userRole] ?? userRole}</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rail-out" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
          </form>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="Abrir menú"><Menu /></button>
          <button className="searchbox" onClick={openPalette} aria-label="Buscar socio, DNI o lote">
            <Search aria-hidden />
            <span>Buscar socio, DNI o lote</span>
            <span className="kbd">{mac ? "⌘" : "Ctrl"} K</span>
          </button>
          <div className="topbar-actions">
            <Link className="btn" href="/dispensario"><Scale aria-hidden /><span>Nueva entrega</span></Link>
          </div>
        </header>
        <main id="contenido" className="page">{children}</main>
      </div>

      <nav className="tabbar" aria-label="Navegación rápida">
        <Link href="/" aria-current={isActive(path, "/") ? "page" : undefined}><LayoutDashboard aria-hidden />Panel</Link>
        <Link href="/socios" aria-current={isActive(path, "/socios") ? "page" : undefined}><Users aria-hidden />Socios</Link>
        <Link href="/dispensario" className="tab-main" aria-current={isActive(path, "/dispensario") ? "page" : undefined}>
          <span className="tab-ico"><Scale aria-hidden /></span>Entregar
        </Link>
        <Link href="/turnos" aria-current={isActive(path, "/turnos") ? "page" : undefined}><CalendarClock aria-hidden />Turnos</Link>
        <button onClick={() => setDrawer(true)}><Menu aria-hidden />Más</button>
      </nav>
    </div>
  );
}

export function MemberShell({ clubName, userName, children }: { clubName: string; userName: string; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <header className="member-top">
        <div className="member-top-inner">
          <span className="monogram" aria-hidden>{monogram(clubName)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontFamily: "var(--font-display)", fontWeight: 650, color: "#fff", fontSize: 15 }}>{clubName}</div>
            <div style={{ fontSize: 12.5, color: "#9fb8aa" }}>Portal del socio · {userName}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rail-out" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
          </form>
        </div>
      </header>
      <main className="member-main">{children}</main>
    </ToastProvider>
  );
}
