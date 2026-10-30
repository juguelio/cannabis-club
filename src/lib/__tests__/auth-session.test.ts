import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), cookie: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
import { createSessionToken, getAnySession, requireAnyUser, requireMember, requireUser } from "../auth";

const user = { id: "staff", email: "staff@example.test", name: "Equipo", role: "ADMIN" as const, active: true, tokenVersion: 2, mustChangePassword: false };
afterEach(() => vi.unstubAllEnvs());
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "test-only-session-secret-not-for-deployment");
  mocks.cookie.mockReturnValue({ value: await createSessionToken(user, 2) });
  mocks.findUnique.mockResolvedValue(user);
});

describe("sesiones verificadas contra el estado actual", () => {
  it("rechaza el JWT anterior a un reset aunque su firma y vencimiento sean válidos", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, tokenVersion: 3 });
    expect(await getAnySession()).toBeNull();
  });
  it("rechaza cuentas desactivadas", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, active: false });
    expect(await getAnySession()).toBeNull();
  });
  it("un permiso en el JWT no sustituye al rol de la base", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, role: "OPERADOR" });
    await expect(requireUser(["ADMIN"])).rejects.toMatchObject({ status: 403 });
  });
  it("bloquea APIs de staff hasta cambiar la clave y permite la gestión de la propia clave", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, mustChangePassword: true });
    await expect(requireUser(["ADMIN"])).rejects.toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    expect((await requireAnyUser()).id).toBe(user.id);
  });
  it("también bloquea acceso API de socio con clave temporal", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, role: "SOCIO", memberId: "member", mustChangePassword: true });
    await expect(requireMember()).rejects.toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
  });
});
