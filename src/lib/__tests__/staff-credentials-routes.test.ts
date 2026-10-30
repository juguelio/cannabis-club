import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: { id: "admin", role: "ADMIN" },
  target: { id: "staff", role: "OPERADOR", active: true },
  findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: vi.fn(async () => mocks.actor), hashPassword: vi.fn(async () => "hashed") }));
vi.mock("@/lib/db", () => {
  const tx = { user: { findUnique: mocks.findUnique, create: mocks.create, update: mocks.update, count: mocks.count }, auditLog: { create: mocks.audit } };
  return { prisma: { ...tx, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } };
});
import { POST } from "../../app/api/users/route";
import { PATCH } from "../../app/api/users/[id]/route";

const request = (body: object, method = "PATCH") => new Request("http://localhost/api/users/staff", { method, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: "staff" }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(mocks.target);
  mocks.update.mockResolvedValue(mocks.target);
  mocks.create.mockResolvedValue(mocks.target);
});

describe("credenciales del equipo: rutas reales, persistencia simulada", () => {
  it("crea acceso temporal con fecha de expiración calculable", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const res = await POST(request({ name: "Equipo", email: "staff@example.test", role: "OPERADOR", password: "Temporal-123" }, "POST"), ctx);
    expect(res.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ mustChangePassword: true, passwordChangedAt: expect.any(Date) });
  });
  it("un reset revoca las sesiones y exige cambiar la nueva clave", async () => {
    const res = await PATCH(request({ password: "Temporal-456" }), ctx);
    expect(res.status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({ mustChangePassword: true, tokenVersion: { increment: 1 }, passwordChangedAt: expect.any(Date) });
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain("Temporal-456");
  });
  it.each([{ active: false }, { active: true }, { role: "DISPENSADOR" }])("revoca tokens al modificar acceso: %j", async (input) => {
    mocks.findUnique.mockResolvedValue({ ...mocks.target, active: !input.active });
    expect((await PATCH(request(input), ctx)).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 });
  });
  it("editar el nombre no interrumpe sesiones", async () => {
    expect((await PATCH(request({ name: "Otro nombre" }), ctx)).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data.tokenVersion).toBeUndefined();
  });
});
