import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel" style={{ maxWidth: 640, margin: "40px auto" }}>
      <div className="panel-head">
        <div>
          <h1 className="panel-title" style={{ fontSize: 22 }}>Esta página no existe</h1>
          <p className="panel-sub">Puede que el socio o el lote se haya escrito mal en la dirección.</p>
        </div>
      </div>
      <div className="panel-body"><Link className="btn btn-quiet" href="/">Volver al panel</Link></div>
    </section>
  );
}
