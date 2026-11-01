-- Vuelve la demo al estado previo a una grabación (sólo base local de demo).
-- Borra la reserva que crea el video del socio y la entrega del mostrador; deja los turnos sembrados.
delete from "StockMovement" where "dispensationId" in (
  select d.id from "Dispensation" d join "Member" m on m.id=d."memberId"
   where m.legajo in (1,3) and d."occurredAt" > now() - interval '6 hours');
delete from "Dispensation" d using "Member" m
 where m.id=d."memberId" and m.legajo in (1,3) and d."occurredAt" > now() - interval '6 hours';

update "PickupRequest" r set status='CONFIRMADA', "fulfilledAt"=null, "dispensationId"=null
  from "Member" m where m.id=r."memberId" and m.legajo in (1,3) and r.id in ('demo-rq-julian','demo-rq-ana');

update "Appointment" a set status='CONFIRMADO', "attendedAt"=null, "dispensationId"=null
  from "Member" m where m.id=a."memberId" and a.id in ('demo-ap-julian','demo-ap-ana');

-- OJO: la reserva que crea el video del socio (María, lunes 2) NO se borra acá:
-- el video de administración la cierra con la entrega. Si hay que repetir el video del socio,
-- correr scripts/videos/reset-socio.sql.
