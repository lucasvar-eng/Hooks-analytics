# Plantilla Maestro De Costos

Esta carpeta deja una base pensada para Google Sheets con una pestana por archivo.

Orden sugerido del documento:

1. `PRODUCTOS_COSTOS.csv`
2. `COSTOS_FIJOS.csv`
3. `COSTOS_ENVIO.csv`
4. `COMISIONES_PAGO.csv`
5. `IMPUESTOS_Y_FEES.csv`
6. `COSTOS_ADICIONALES.csv`

Reglas:

- Fechas en formato `YYYY-MM-DD`
- Porcentajes sin `%`
- Moneda sugerida: `ARS`
- En `PRODUCTOS_COSTOS`, alcanza con `tnProductId` o `sku`, pero idealmente completar ambos
- No duplicar `tnProductId` dentro de la misma pestaña
- Si un costo deja de aplicar, completar `periodEnd` o dejarlo inactivo cuando tengamos el import completo

Importante:

- Hoy la app ya importa de forma mas directa `PRODUCTOS_COSTOS`
- Las otras pestanas estan preparadas para ordenar la carga manual actual y para un import mas completo despues
