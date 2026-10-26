"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";

/**
 * Alta online siempre a un toque. Aparece cuando el hero sale de pantalla, para no
 * competir con el botón grande de arriba, y queda separado del WhatsApp de consultas.
 */
export function SiteJoinFloat() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(".s-hero");
    if (!hero) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: "-70px 0px 0px 0px",
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <Link className="s-join-float" href="/login?alta=1" aria-label="Quiero asociarme: el alta es online">
      <UserPlus aria-hidden />
      Asociarme
    </Link>
  );
}
