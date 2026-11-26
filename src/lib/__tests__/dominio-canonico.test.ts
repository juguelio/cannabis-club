import { describe, expect, it } from "vitest";
import { codigoDeRedireccion, destinoCanonico, DOMINIO_CANONICO, HOSTS_ALIAS } from "../dominio-canonico";

describe("destinoCanonico", () => {
  it("manda el .org.ar al .com.ar con el mismo camino", () => {
    expect(destinoCanonico("republicacannabis.org.ar", "/login", "")).toBe(
      `https://${DOMINIO_CANONICO}/login`,
    );
  });

  it("también con www, que es otro host para la cookie y para Google", () => {
    expect(destinoCanonico("www.republicacannabis.org.ar", "/solicitud", "")).toBe(
      `https://${DOMINIO_CANONICO}/solicitud`,
    );
  });

  it("conserva la query: un link a un paso concreto sigue apuntando a lo mismo", () => {
    expect(destinoCanonico("republicacannabis.org.ar", "/login", "?alta=1&volver=%2Fportal")).toBe(
      `https://${DOMINIO_CANONICO}/login?alta=1&volver=%2Fportal`,
    );
  });

  it("acepta la query sin el signo de pregunta", () => {
    expect(destinoCanonico("republicacannabis.org.ar", "/login", "alta=1")).toBe(
      `https://${DOMINIO_CANONICO}/login?alta=1`,
    );
  });

  it("no toca el canónico ni el www del canónico", () => {
    expect(destinoCanonico("republicacannabis.com.ar", "/login", "")).toBeNull();
    expect(destinoCanonico("www.republicacannabis.com.ar", "/login", "")).toBeNull();
  });

  it("no toca el alias de Vercel: es el respaldo si el dominio falla", () => {
    expect(destinoCanonico("cannabis-club-mauve.vercel.app", "/login", "")).toBeNull();
  });

  it("no toca el desarrollo local", () => {
    expect(destinoCanonico("127.0.0.1:3510", "/login", "")).toBeNull();
    expect(destinoCanonico("localhost:3300", "/login", "")).toBeNull();
  });

  it("ignora mayúsculas y el puerto", () => {
    expect(destinoCanonico("REPUBLICACANNABIS.ORG.AR:443", "/login", "")).toBe(
      `https://${DOMINIO_CANONICO}/login`,
    );
  });

  it("un host vacío no redirige a ningún lado", () => {
    expect(destinoCanonico("", "/login", "")).toBeNull();
  });

  it("la lista de alias es sólo el .org.ar, con y sin www", () => {
    expect(HOSTS_ALIAS).toEqual(["republicacannabis.org.ar", "www.republicacannabis.org.ar"]);
  });
});

describe("codigoDeRedireccion", () => {
  it("301 para lecturas: los buscadores mueven el índice al canónico", () => {
    expect(codigoDeRedireccion("GET")).toBe(301);
    expect(codigoDeRedireccion("get")).toBe(301);
    expect(codigoDeRedireccion("HEAD")).toBe(301);
  });

  it("308 para el resto: un 301 convertiría el POST en GET y perdería el cuerpo", () => {
    expect(codigoDeRedireccion("POST")).toBe(308);
    expect(codigoDeRedireccion("PUT")).toBe(308);
    expect(codigoDeRedireccion("DELETE")).toBe(308);
  });

  it("sin método asume lectura", () => {
    expect(codigoDeRedireccion("")).toBe(301);
  });
});
