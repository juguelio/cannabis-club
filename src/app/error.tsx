"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="card card-pad"><h1 className="page-title">No pudimos cargar esta sección</h1><p className="page-sub mb-5">Revisá tu conexión y volvé a intentar. Si estabas guardando una operación, verificá el registro antes de repetirla.</p><button className="btn" onClick={reset}>Volver a intentar</button></section>;
}
