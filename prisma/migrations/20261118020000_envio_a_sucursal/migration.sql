-- Envío a sucursal: el club lleva el pedido a la sucursal de Andreani más cercana al domicilio
-- del socio y el socio lo retira ahí. Aditivo: no toca pedidos existentes.
ALTER TYPE "DeliveryMode" ADD VALUE IF NOT EXISTS 'SUCURSAL';
