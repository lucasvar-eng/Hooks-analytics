# Auditoria funcional y UX - 2026-04-01

## Objetivo

Ordenar que hace cada pestana de Hooks Analytics, como deberia leerse cada una, que esta maduro, que esta sobrecargado y que puntos conviene corregir o simplificar.

## Verificacion tecnica rapida

- `frontend`: `npm run build` OK.
- `frontend`: warning de bundle grande (`dist/assets/index-86GLe-Cg.js` ~706 kB).
- `backend`: hay un proceso ocupando puerto `3000`, pero desde esta sesion el acceso local no fue estable, asi que la validacion runtime completa quedo parcial.
- `router + pages + backend routes`: las pestanas principales si estan conectadas a endpoints reales.

## Mapa de la app

### Home

- Funcion: listado de tiendas, metricas resumidas y alertas activas por tienda.
- Lectura esperada: tablero de cartera, no analisis profundo.
- Estado: claro y liviano.
- Sumar: semaforo visual por salud de datos / ultima sync.
- Sobra: poco.

### Resumen

- Funcion: lectura ejecutiva del negocio con KPIs principales y layout configurable.
- Que debe analizarse: revenue, ordenes, ad spend, profit, margen, true ROAS, AOV, CVR, estados de salud.
- Como deberia verse: 1 bloque hero de KPIs, luego detalle modular.
- Estado: bien orientado. Tiene buena jerarquia.
- Riesgo: la flexibilidad de bloques puede hacer que distintos usuarios armen layouts inconsistentes.
- Sumar: presets mas opinionados por rol.
- Sobra: demasiada libertad si todavia se esta definiendo el estandar de lectura.

### Tienda

- Funcion: operacion comercial, NC/RC, medios de pago, detalle diario, sync y auditoria.
- Que debe analizarse: volumen de ordenes, revenue bruto/neto, liquidable, AOV, NC/RC, devoluciones, calidad de conciliacion.
- Como deberia verse: primero lectura comercial, luego un bloque operativo, y la auditoria mas separada.
- Estado: modulo muy potente y probablemente el mas completo del negocio.
- Sumar: separar visualmente "comercial" de "auditoria tecnica".
- Sobra: demasiadas tabs en la misma zona; `sync` y `audit` compiten con tabs mas comerciales.

### Meta Ads

- Funcion: adquisicion, campanas, daily tracker e importacion CSV.
- Que debe analizarse: spend, revenue ads, compras, ROAS, CPA, CTR, CPM, cuentas conectadas.
- Como deberia verse: bloque ejecutivo arriba, campanas abajo, import manual en nivel secundario.
- Estado: bien pensado y bastante maduro.
- Sumar: un estado vacio mas explicativo cuando no hay cuentas conectadas o no hay spend.
- Sobra: la tab `Importar CSV` dentro del flujo principal puede distraer si la integracion Meta ya esta resuelta.

### Creativos

- Funcion: performance creativa, framework estrategico, backlog y brief AI.
- Que debe analizarse: tiers A-E, winners/losers, gaps de framework, backlog de tests, brief AI.
- Como deberia verse: 1 resumen de salud creativa, 1 pipeline accionable, 1 zona de export/reporting.
- Estado: muy valioso, pero hoy esta demasiado cargado.
- Sumar: dividir en 2 subzonas claras: "Performance" y "Sistema creativo".
- Sobra: demasiadas acciones arriba al mismo tiempo (`brief`, `guardar`, `exportar`, `sync`, `maestro`).

### Cashflow

- Funcion: cobros, comisiones y proyeccion.
- Que debe analizarse: bruto, liquidable, recibido, pendiente, impacto de costos fijos.
- Como deberia verse: muy simple y financiera.
- Estado: correcto, legible, directo.
- Sumar: alertas por descalce o demora anormal de cobro.
- Sobra: poco.

### Costos

- Funcion: P&L, breakeven, consistencia financiera, costos fijos y carga de CSV.
- Que debe analizarse: profit oficial, margen, cobertura de costos, breakeven, reconciliacion entre fuentes.
- Como deberia verse: modulo financiero con jerarquia fuerte en "verdad oficial".
- Estado: fuerte en contenido; muy util para cerrar el numero real.
- Sumar: un resumen tipo "estado del P&L" al inicio con recomendaciones cortas.
- Sobra: CSV y configuracion operativa quedan muy mezclados con la lectura ejecutiva del P&L.

### Productos

- Funcion: catalogo, margen por SKU, rotacion, aging, concentracion y stock health.
- Que debe analizarse: ingresos por SKU, stock valorizado, cobertura de costos, dead stock, sobrestock, riesgo de quiebre.
- Como deberia verse: primero salud del catalogo, despues matrices y recien al final la tabla grande.
- Estado: muy bueno para decisiones comerciales.
- Sumar: filtros mas fuertes arriba de la tabla.
- Sobra: demasiados bloques antes de llegar al listado; la pantalla puede sentirse larga.

### Clientes

- Funcion: segmentos RFM, cohorts y listado.
- Que debe analizarse: cantidad por segmento, revenue por segmento, calidad de datos, retencion.
- Como deberia verse: simple y analitico.
- Estado: correcto, pero menos profundo que otros modulos.
- Sumar: insights mas accionables por segmento y comparativa temporal.
- Sobra: poco.

### Competencia

- Funcion: CRM de competidores + analisis AI de oportunidades.
- Que debe analizarse: posicionamiento, avatar, awareness, angulos, territorios y gaps propios.
- Como deberia verse: research board, no dashboard financiero.
- Estado: util como base estrategica.
- Sumar: ranking de competidores por cercania / amenaza / inspiracion.
- Sobra: depende bastante de carga manual; si no se usa con disciplina pierde valor rapido.

### Topic Map

- Funcion: mapa de topicos, hipotesis y gaps del framework.
- Que debe analizarse: prioridades, estados, awareness, territorios, angulos faltantes.
- Como deberia verse: tablero editorial/estrategico.
- Estado: consistente con Creativos y Language Bank.
- Sumar: relacion visual con performance real.
- Sobra: puede solaparse con Language Bank si no se define bien su alcance.

### Language Bank

- Funcion: frases, objeciones, vocabulario y hooks.
- Que debe analizarse: libreria de mensajes, objeciones sin respuesta, huecos de lenguaje.
- Como deberia verse: base de conocimiento muy util para copy.
- Estado: bien orientado.
- Sumar: relacion con topicos y creativos ganadores.
- Sobra: separado de Topic Map puede sentirse duplicado para usuarios no avanzados.

### Simulador

- Funcion: what-if rapido sobre CPM, CTR, CVR, AOV y budget.
- Que debe analizarse: impacto en revenue, ROAS, CPA y profit.
- Como deberia verse: herramienta simple de decision.
- Estado: claro y util.
- Sumar: escenarios guardables.
- Sobra: poco.

### Reportes

- Funcion: repositorio de analisis y reportes guardados.
- Que debe analizarse: historial, snapshots, exportacion y trazabilidad.
- Como deberia verse: biblioteca limpia.
- Estado: util, pero hoy mezcla almacenamiento, visualizacion y plantillas.
- Sumar: filtros por seccion, tipo y fecha.
- Sobra: el detalle usa render HTML inseguro desde markdown crudo.

### Reporte AI / Report Builder

- Funcion: construir un reporte multi-seccion.
- Estado: idea buena, implementacion incompleta.
- Problema central: hoy el guardado no habla el mismo contrato que el backend.
- Recomendacion: o se corrige y se consolida como flujo principal de reportes, o se oculta temporalmente.

### Alertas

- Funcion: cola de alertas activas, reconocidas y resueltas.
- Que debe analizarse: severidad, tipo, fecha y accion.
- Como deberia verse: inbox operacional, muy clara.
- Estado: simple y entendible.
- Sumar: link directo al modulo origen.
- Sobra: poco.

### Automatizaciones

- Funcion: reglas locales para correr analisis repetidos.
- Que debe analizarse: estado de AI, reglas activas, ultimo reporte, readiness de integraciones.
- Como deberia verse: un panel operativo, no promesa de orquestacion compleja.
- Estado: funcional, pero aun "semi-MVP".
- Sumar: templates listos por objetivo.
- Sobra: el bloque de integraciones puede hacer creer que ya existe una capa de automatizacion mucho mas avanzada de la que realmente hay.

### Settings

- Funcion: integraciones, objetivos, AI context, Google Sheets, umbrales, metricas home y configuracion financiera.
- Que debe analizarse: solo setup. No deberia usarse para lectura operativa diaria.
- Como deberia verse: centro de configuracion por secciones muy claras.
- Estado: poderoso pero demasiado largo y monolitico.
- Sumar: subnavegacion interna o tabs.
- Sobra: demasiadas responsabilidades en una sola pagina.

## Prioridades de simplificacion

### Alta

- Simplificar `Creativos` en dos vistas o dos tabs internas.
- Separar en `Tienda` la lectura comercial de la auditoria tecnica.
- Reordenar `Costos` para que la verdad financiera quede mas arriba y la carga de CSV quede mas abajo.
- Fragmentar `Settings`.

### Media

- Definir mejor la frontera entre `Topic Map`, `Language Bank` y `Competencia`.
- Llevar `Meta CSV import` a un estado secundario.
- Compactar `Productos` arriba de la tabla.

### Baja

- Ajustar microcopy y estados vacios en varios modulos.
- Mejorar filtros y exportaciones.

## Hallazgos concretos

1. `Report Builder` no puede guardar correctamente.
   - Frontend envia `content`, `from`, `to`, `sections`.
   - Backend espera `titulo`, `contenido`, `dateRange`, etc.
   - Impacto: la pantalla parece lista, pero el guardado puede fallar o crear documentos invalidos.

2. `Reportes` y `AIAnalysisPanel` renderizan HTML generado desde markdown sin sanitizacion.
   - Impacto: riesgo de XSS si algun contenido guardado incluye HTML malicioso o inesperado.

3. `Clientes` genera analisis AI sin pasar rango de fechas.
   - Impacto: inconsistencia con el selector global y con el resto de la app.

4. El bundle principal del frontend ya es pesado.
   - Impacto: crecimiento de complejidad y posible degradacion de carga si siguen entrando modulos sin code-splitting.

## Decision de producto recomendada

- Mantener como nucleo: `Resumen`, `Tienda`, `Meta Ads`, `Costos`, `Productos`, `Clientes`, `Cashflow`, `Alertas`.
- Mantener como capa estrategica: `Creativos`, `Competencia`, `Topic Map`, `Language Bank`, `Reportes`.
- Tratar como capa todavia en maduracion: `Automatizaciones`, `Report Builder`.
- Reducir complejidad percibida separando "lectura del negocio" de "configuracion" y de "sistema creativo".

## Siguiente paso sugerido

Hacer una pasada de producto con tres objetivos:

1. Definir el orden oficial de lectura por tienda.
2. Establecer que modulos son core y cuales son avanzados.
3. Corregir primero los bugs que hacen prometer mas de lo que hoy funciona.
