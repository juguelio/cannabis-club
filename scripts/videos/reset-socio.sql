-- Borra la reserva que crea el video del socio, para poder repetirlo.
delete from "PickupRequest" r using "Member" m
 where m.id=r."memberId" and m.legajo=1 and r."createdAt" > now() - interval '12 hours';
delete from "Appointment" a using "Member" m
 where m.id=a."memberId" and m.legajo=1 and a."createdAt" > now() - interval '12 hours' and a.status <> 'AUSENTE';
