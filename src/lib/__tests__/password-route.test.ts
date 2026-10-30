import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), updated: vi.fn(), audit: vi.fn(), startSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireAnyUser: async () => ({ id: "user", tokenVersion: 2 }),
  verifyPassword: async () => true,
  hashPassword: async () => "new-hash",
  startSession: mocks.startSession,
}));
vi.mock("@/lib/db", () => {
  const tx = { user: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.updated }, auditLog: { create: mocks.audit } };
  return { prisma: { user: { findUnique: mocks.findUnique }, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) } };
});
import { POST } from "../../app/api/auth/password/route";
const user = { id: "user", active: true, tokenVersion: 2, passwordHash: "old-hash", role: "ADMIN", email: "user@example.test", name: "User", memberId: null };
const req = () => new Request("http://localhost/api/auth/password", { method: "POST", body: JSON.stringify({ current: "Previous-123", next: "Changed-456" }) });
const ctx = { params: Promise.resolve({}) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(user);
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.updated.mockResolvedValue({ ...user, tokenVersion: 3 });
  mocks.audit.mockResolvedValue({});
});
describe("cambio propio de clave", () => {
  it("rechaza una sesión invalidada entre la autenticación y la lectura", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, tokenVersion: 3 });
    expect((await POST(req(), ctx)).status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("un reset concurrente no puede ser sobrescrito ni emitir una sesión nueva", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(req(), ctx)).status).toBe(409);
    expect(mocks.updateMany.mock.calls[0][0].where).toMatchObject({ tokenVersion: 2, passwordHash: "old-hash", active: true });
    expect(mocks.startSession).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("audita el cambio antes de emitir la sesión con versión nueva", async () => {
    expect((await POST(req(), ctx)).status).toBe(200);
    expect(mocks.startSession).toHaveBeenCalledWith(expect.objectContaining({ id: "user" }), 3);
    expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(mocks.startSession.mock.invocationCallOrder[0]);
  });
});
