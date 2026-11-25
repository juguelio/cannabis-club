"use client";

import { ValidatedForm } from "@/components/validated-form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  BellRing, CalendarClock, FileSpreadsheet, LayoutDashboard, LogOut, Mail, Menu, Receipt, Scale, Search, Settings, Sprout, TriangleAlert, Truck, Users, X,
} from "lucide-react";
import { CommandPalette, useOpenPalette } from "./command-palette";
import { ToastProvider } from "./toast";
import { BrandMark, type BrandMarkInfo } from "./brand-mark";
import { permite, seccionDeRuta, type Seccion } from "@/lib/roles";

type NavItem = { href: string; label: string; icon: React.ElementType; count?: number };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}


const ROLE: Record<string, string> = { ADMIN: "Administración", OPERADOR: "Operador", DISPENSADOR: "Dispensario" };

export function Shell(props: {
  clubName: string;
  mark: BrandMarkInfo;
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

function ShellInner({ clubName, mark, userName, userRole, clubConfigured, pendingPickups, todayAppointments, children }: Parameters<typeof Shell>[0]) {
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

  // El menú sale de la matriz de roles: lo que no puede abrir, no lo ve.
  const visibles = (items: NavItem[], seccion: (i: NavItem) => string) => items.filter((i) => permite(userRole, seccion(i) as Seccion));

  const daily: NavItem[] = visibles(
    [
      { href: "/", label: "Panel", icon: LayoutDashboard },
      { href: "/pedidos", label: "Pedidos", icon: Scale, count: pendingPickups },
      { href: "/dispensario", label: "Dispensario", icon: Scale },
      { href: "/turnos", label: "Turnos", icon: CalendarClock, count: todayAppointments },
      { href: "/calendario", label: "Calendario", icon: CalendarClock },
    ],
    (i) => seccionDeRuta(i.href) ?? "panel",
  );
  const club: NavItem[] = visibles(
    [
      { href: "/socios", label: "Socios", icon: Users },
      { href: "/stock", label: "Stock y lotes", icon: Sprout },
      { href: "/traslados", label: "Traslados", icon: Truck },
      { href: "/aportes", label: "Aportes", icon: Receipt },
      { href: "/control", label: "Control", icon: Sprout },
      { href: "/avisos", label: "Avisos", icon: BellRing },
      { href: "/cartas", label: "Cartas", icon: Mail },
      { href: "/cierre-mensual", label: "Cierre mensual", icon: FileSpreadsheet },
      { href: "/informe-semestral", label: "Informe semestral", icon: FileSpreadsheet },
      { href: "/reportes", label: "Libros", icon: FileSpreadsheet },
    ],
    (i) => seccionDeRuta(i.href) ?? "panel",
  );
  const admin: NavItem[] = visibles(
    [
      { href: "/inspeccion", label: "Modo inspección", icon: FileSpreadsheet },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
    (i) => seccionDeRuta(i.href) ?? "panel",
  );

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
            <BrandMark info={mark} />
            <span style={{ minWidth: 0 }}>
              <span className="rail-club wordmark" style={{ display: "block" }}>{clubName}</span>
              <span className="rail-sub" style={{ display: "block" }}>Asociación de cultivo</span>
            </span>
          </Link>
          {drawer ? (
            <button className="icon-btn" style={{ color: "var(--on-dark-2)" }} onClick={() => setDrawer(false)} aria-label="Cerrar menú"><X /></button>
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
          <ValidatedForm action="/api/auth/logout" method="post">
            <button className="rail-out" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
          </ValidatedForm>
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

export function MemberShell({ clubName, mark, userName, children }: { clubName: string; mark: BrandMarkInfo; userName: string; children: React.ReactNode }) {
  return (
    <ToastProvider>
      <header className="member-top">
        <div className="member-top-inner">
          <BrandMark info={mark} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate wordmark member-top-club">{clubName}</div>
            <div className="member-top-sub">Portal del socio · {userName}</div>
          </div>
          <ValidatedForm action="/api/auth/logout" method="post">
            <button className="rail-out" type="submit" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={16} /></button>
          </ValidatedForm>
        </div>
      </header>
      <main className="member-main">{children}</main>
    </ToastProvider>
  );
}
