/**
 * Mientras el servidor arma la pantalla del socio: el esqueleto aparece al instante en vez de dejar la
 * pantalla anterior congelada. Misma forma que lo que llega (franja, tarjetas, lista).
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="stack" style={{ gap: 14 }}>
      <div className="skeleton" style={{ height: 88 }} />
      <div className="skeleton" style={{ height: 28, width: "45%" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap: 14 }}>
        <div className="skeleton" style={{ height: 260 }} />
        <div className="skeleton" style={{ height: 260 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    </div>
  );
}
