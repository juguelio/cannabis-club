"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, ShoppingBasket } from "lucide-react";
import { useCarrito } from "@/lib/carrito-cliente";

/**
 * Navegación del portal, arriba y siempre visible, como en las tiendas que el socio ya usa: a la
 * izquierda dónde entregamos, al centro las secciones, a la derecha la cuenta y el basket.
 *
 * El conteo del basket sale del carrito guardado en el navegador, así que el número es el mismo en
 * todas las pantallas.
 */
export function PortalHeader({
  marca,
  nombre,
  localidad,
  cp,
  tope,
  activos,
}: {
  /** Marca del club: la misma que usa el sitio, el login y el favicon. No es texto fijo. */
  marca: { nombre: string; sigla: string; logo: string | null };
  nombre: string;
  localidad: string | null;
  cp: string | null;
  tope: number;
  activos: number;
}) {
  const { contar, total, listo } = useCarrito(tope);
  const ruta = usePathname();
  // En el cambio de clave obligatorio el socio no puede navegar a ningún lado todavía.
  if (ruta === "/portal/clave") return null;

  // Dentro del pedido, el carrito ya se volcó: el número sería siempre cero.
  const enPedido = ruta.startsWith("/portal/pedido");
  const pasoPedido = ruta.startsWith("/portal/pedido/pago")
    ? "Falta el pago"
    : ruta.startsWith("/portal/pedido/listo")
      ? "Cerrado"
      : "Elegir la entrega";

  const secciones = [
    { href: "/portal", label: "Catálogo", activa: ruta === "/portal" },
    { href: "/portal/envios", label: "Envíos", activa: ruta === "/portal/envios" },
    { href: "/portal/datos", label: "Mis datos", activa: ruta === "/portal/datos" },
    { href: "/portal#mis-pedidos", label: `Mis pedidos${activos > 0 ? ` (${activos})` : ""}`, activa: false },
  ];

  return (
    <header className="ph">
      <div className="ph-top">
        <div className="ph-marca">
          <Link href="/portal" className="ph-logo" aria-label={marca.nombre}>
            {marca.logo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={marca.logo} alt={marca.nombre} className="ph-logo-img" />
            ) : (
              <>
                <span className="ph-logo-sigla">{marca.sigla}</span>
                {marca.nombre}
              </>
            )}
          </Link>
          <Link href="/portal/datos" className="ph-dir" title="Cambiar la dirección de entrega">
            <MapPin aria-hidden size={15} />
            <span>
              <small>Enviar a {nombre}</small>
              <b>{localidad && cp ? `${localidad} ${cp}` : "Elegí tu dirección"}</b>
            </span>
          </Link>
        </div>

        <nav className="ph-nav" aria-label="Secciones del portal">
          {secciones.map((s) => (
            <Link key={s.href} href={s.href} className={s.activa ? "ph-link ph-link--on" : "ph-link"} aria-current={s.activa ? "page" : undefined}>
              {s.label}
            </Link>
          ))}
        </nav>

        {/* En el pedido el carrito ya se volcó: mostrarlo vacío sólo confunde. Va el paso en curso. */}
        {enPedido ? (
          <span className="ph-basket ph-basket--paso">
            <ShoppingBasket aria-hidden size={20} />
            <span className="ph-basket-txt">
              Tu pedido
              <small>{pasoPedido}</small>
            </span>
          </span>
        ) : (
        <Link href="/portal/basket" className="ph-basket" aria-label={listo ? `Basket con ${contar} renglones` : "Basket"}>
          <ShoppingBasket aria-hidden size={20} />
          <span className="ph-basket-num tnum" aria-hidden>
            {listo ? contar : 0}
          </span>
          <span className="ph-basket-txt">
            Basket
            <small className="tnum">{listo && total > 0 ? `${total} g` : "vacío"}</small>
          </span>
        </Link>
        )}
      </div>
    </header>
  );
}
