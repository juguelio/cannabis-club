export default function Loading() {
  return <div role="status" aria-live="polite"><p className="page-sub mb-5">Cargando tu espacio de gestión…</p><div className="kpi-grid">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" />)}</div></div>;
}
