"use client";

import { useState } from "react";
import { Input } from "./validated-form";

export function ReportDates({ slug, monthStart }: { slug: string; monthStart: string }) {
  const [desde, setDesde] = useState(monthStart);
  return (
    <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div>
        <label className="label" htmlFor={slug + "-d"}>Desde</label>
        <Input className="input" id={slug + "-d"} type="date" name="desde" value={desde} onChange={e => setDesde(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={slug + "-h"}>Hasta</label>
        <Input className="input" id={slug + "-h"} type="date" name="hasta" min={desde || undefined} />
      </div>
    </div>
  );
}
