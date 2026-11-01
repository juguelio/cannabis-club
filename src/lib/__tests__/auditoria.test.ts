import { describe, expect, it } from "vitest";
import { AUDIT_ACTION, AUDIT_ENTITY, AUDIT_SESSION, auditAction, auditEntity } from "../labels";

/**
 * La pantalla de inspección mostraba los códigos crudos (LOGIN, CLOSED_DAY_REMOVE).
 * El test fija que toda acción que la app escribe tenga su etiqueta: si alguien agrega
 * una acción y no la suma al diccionario, esto falla antes de que el club lea un código.
 */
const ACCIONES_DEL_CODIGO = [
  "ACCESS_APPROVED_NOTICE", "ACCESS_DOC_RETENTION", "ACCESS_DOC_UPLOAD", "ACCESS_DOC_VIEW",
  "ACCESS_REJECTED_NOTICE", "ACCESS_REQUEST_APPROVE", "ACCESS_REQUEST_REJECT", "APPOINTMENT_CREATE",
  "BATCH_CREATE", "BATCH_HARVEST", "BATCH_RECALL", "BATCH_RELEASE", "CLOSED_DAY_ADD", "CLOSED_DAY_REMOVE",
  "CLUB_BRAND_UPDATE", "CLUB_UPDATE", "CONSENT_GRANT", "CONSENT_REVOKE", "DISPENSATION_CREATE",
  "DISPENSATION_VOID", "LOGIN", "LOGIN_FAILED", "LOGIN_GOOGLE", "LOGOUT", "MEMBER_CREATE", "MEMBER_IMPORT",
  "MONTHLY_CLOSE", "MOVEMENT_CREATE", "NOTICE_SENT", "PICKUP_CANCEL", "PICKUP_CONFIRM", "PICKUP_CREATE",
  "PICKUP_PARTIAL", "PORTAL_GRANT", "PORTAL_RESET", "PORTAL_REVOKE", "SCHEDULE_RULE_ADD",
  "SCHEDULE_RULE_UPDATE", "SEMESTER_REPORT", "SHIPMENT_CANCEL", "SHIPMENT_DELIVER", "SHIPMENT_DISPATCH",
  "STRAIN_CREATE", "STRAIN_EDIT", "STRAIN_PHOTO", "STRAIN_PHOTO_DELETE", "USER_APPROVE", "USER_CREATE",
  "USER_PENDING", "USER_REJECT", "USER_UPDATE",
];

const ENTIDADES_DEL_CODIGO = [
  "Member", "Batch", "Strain", "Dispensation", "PickupRequest", "Appointment", "Club", "User",
  "ClosedDay", "MonthlyClose", "SemesterReport", "Shipment", "AccessRequest", "AccessDocument",
  "Consent", "StockMovement", "ScheduleRule",
];

describe("auditoría en lenguaje de club", () => {
  it("toda acción que la app registra tiene etiqueta", () => {
    expect(ACCIONES_DEL_CODIGO.filter((a) => !AUDIT_ACTION[a])).toEqual([]);
  });

  it("toda entidad que la app registra tiene nombre", () => {
    expect(ENTIDADES_DEL_CODIGO.filter((e) => !AUDIT_ENTITY[e])).toEqual([]);
  });

  it("no quedan códigos con guión bajo visibles para el club", () => {
    for (const a of ACCIONES_DEL_CODIGO) expect(auditAction(a)).not.toMatch(/_/);
    for (const e of ENTIDADES_DEL_CODIGO) expect(auditEntity(e)).not.toMatch(/_/);
  });

  it("un código nuevo se humaniza en vez de mostrarse crudo", () => {
    expect(auditAction("ALGO_NUEVO")).toBe("algo nuevo");
    expect(auditEntity("EntidadNueva")).toBe("EntidadNueva");
    expect(auditEntity(null)).toBe("—");
  });

  it("los ingresos se reconocen como ruido de sesión", () => {
    expect([...AUDIT_SESSION]).toEqual(["LOGIN", "LOGIN_GOOGLE", "LOGOUT"]);
    expect([...AUDIT_SESSION]).not.toContain("LOGIN_FAILED");
  });
});
