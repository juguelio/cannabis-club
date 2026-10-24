"use client";
import { RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel" style={{ maxWidth: 640, margin: "40px auto" }}>
      <div className="panel-head">
        <div>
          <h1 className="panel-title" style={{ fontSize: 22 }}>No se pudo cargar esta pantalla</h1>
          <p className="panel-sub">
            Revisá la conexión y volvé a intentar. Si estabas registrando una entrega, buscala en el libro antes de repetirla.
          </p>
        </div>
      </div>
      <div className="panel-body">
        <button className="btn" onClick={reset}><RotateCcw aria-hidden /> Volver a intentar</button>
      </div>
    </section>
  );
}
