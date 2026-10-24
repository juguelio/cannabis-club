export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="stack">
      <div className="skeleton" style={{ height: 44, width: "40%" }} />
      <div className="skeleton" style={{ height: 96 }} />
      <div className="grid-2">
        <div className="skeleton" style={{ height: 280 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    </div>
  );
}
