// Run only against the isolated demo database described in docs/admin-upgrade.md.
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
const origin = process.env.SMOKE_URL ?? 'http://localhost:3301';
const dbUrl = new URL(process.env.DATABASE_URL ?? '');
assert.equal(new URL(origin).hostname, 'localhost');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '55434', 'This smoke test only supports the disposable database on 55434');
const prisma = new PrismaClient();
let checks = 0;
async function call(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await res.json(); return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
function check(actual, expected) { assert.equal(actual, expected); checks++; }
try {
  check((await call('/api/members')).status, 401);
  const admin = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@club.test', password: 'Admin1234!' } });
  check(admin.status, 200);
  const operator = await call('/api/auth/login', { method: 'POST', body: { email: 'operador@club.test', password: 'Operador1234!' } });
  check(operator.status, 200);
  const cookie = admin.cookie;
  check((await call('/api/club', { method: 'PATCH', cookie: operator.cookie, body: { nombre: 'No autorizado' } })).status, 403);
  check((await call('/api/club', { method: 'PATCH', cookie, body: { limiteMensualG: 1 } })).status, 400);
  check((await call('/api/club', { method: 'PATCH', cookie, body: { nombre: 'Club demo · verificación' } })).status, 200);
  check(await prisma.auditLog.count({ where: { action: 'CLUB_UPDATE' } }) > 0, true);
  const members = await call('/api/members', { cookie });
  const member = members.data.members[0];
  check((await call(`/api/members/${member.id}`, { method: 'PATCH', cookie, body: { reprocannExpiresAt: '2026-02-30' } })).status, 400);
  check((await call(`/api/members/${member.id}`, { method: 'PATCH', cookie, body: { phone: 'demo-actualizado' } })).status, 200);
  check((await prisma.member.findUnique({ where: { id: member.id } })).phone, 'demo-actualizado');
  const deliveries = await call('/api/dispensations', { cookie });
  check(JSON.stringify(deliveries.data).includes('passwordHash'), false);
  check(JSON.stringify((await call(`/api/members/${member.id}`, { cookie })).data).includes('passwordHash'), false);
  const batch = await prisma.batch.findFirst({ where: { dryWeightG: null } });
  assert.ok(batch, 'Seed must include an unharvested batch');
  const harvests = await Promise.all([1, 2].map(() => call(`/api/batches/${batch.id}/harvest`, { method: 'POST', cookie, body: { dryWeightG: 2 } })));
  check(harvests.filter(r => r.status === 200).length, 1);
  check(harvests.filter(r => r.status === 409).length, 1);
  check(await prisma.stockMovement.count({ where: { batchId: batch.id, type: 'INGRESO' } }), 1);
  const withdrawals = await Promise.all([1, 2].map(() => call('/api/movements', { method: 'POST', cookie, body: { batchId: batch.id, type: 'AJUSTE_NEGATIVO', grams: 2, reason: 'Prueba de concurrencia' } })));
  check(withdrawals.filter(r => r.status === 201).length, 1);
  check(withdrawals.filter(r => r.status === 409).length, 1);
  const dispense = await prisma.dispensation.findFirst({ where: { voidedAt: null } });
  assert.ok(dispense);
  const voids = await Promise.all([1, 2].map(() => call(`/api/dispensations/${dispense.id}/void`, { method: 'POST', cookie, body: { reason: 'Prueba concurrente de anulación' } })));
  check(voids.filter(r => r.status === 200).length, 1);
  check(voids.filter(r => r.status === 409).length, 1);
  await prisma.user.update({ where: { email: 'operador@club.test' }, data: { active: false } });
  try { check((await call('/api/members', { cookie: operator.cookie })).status, 401); }
  finally { await prisma.user.update({ where: { email: 'operador@club.test' }, data: { active: true } }); }
  console.log(`PASS: ${checks} integration checks (permissions, settings, validation, privacy, concurrent stock, revoked sessions)`);
} finally { await prisma.$disconnect(); }
