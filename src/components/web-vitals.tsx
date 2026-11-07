"use client";

import { useReportWebVitals } from "next/web-vitals";

/** `/socios/ckx…` → `/socios/:id`: la ruta sin identificadores, para agrupar y no guardar a quién se miró. */
export function rutaSinIds(path: string): string {
  return (
    path
      .split("?")[0]
      .split("/")
      .map((seg) => (/^[a-z0-9]{20,}$/i.test(seg) || /^\d+$/.test(seg) ? ":id" : seg))
      .join("/") || "/"
  );
}

/**
 * Velocidad medida en los teléfonos y computadoras de verdad (LCP, INP, CLS, FCP, TTFB).
 * Se manda a `/api/vitals`, que sólo la escribe en los logs: sin terceros, sin cookies, sin quién.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: Math.round(metric.value * (metric.name === "CLS" ? 1000 : 1)) / (metric.name === "CLS" ? 1000 : 1),
        rating: metric.rating,
        route: rutaSinIds(window.location.pathname),
        nav: metric.navigationType,
        w: window.innerWidth,
      });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/vitals", new Blob([body], { type: "application/json" }));
      else void fetch("/api/vitals", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    } catch {
      // Medir nunca puede romper la pantalla.
    }
  });
  return null;
}
