# ANALISIS EXHAUSTIVO DE ESCALAFY
## Plataforma de Rentabilidad Real para E-commerce LATAM

---

## 1. QUE ES ESCALAFY

Escalafy es una aplicacion web de analytics financiero para e-commerce, enfocada en el mercado latinoamericano (principalmente Argentina). Su propuesta central: "la unica app que te muestra si tu e-commerce gana o pierde plata, conectando todas tus ventas y sumando todos tus costos ocultos para mostrarte tu profit real, en tiempo real."

- **Fundacion**: Lanzada el 6 de octubre de 2025
- **Base**: Argentina (direccion legal en Casper, WY, USA)
- **Usuarios activos reportados**: 587 marcas
- **Facturacion combinada de usuarios**: $18,343,750/mes
- **Idioma**: Solo espanol (sin traduccion al ingles)
- **Rating Shopify**: 5.0/5 (23 reviews, 100% cinco estrellas)

---

## 2. ARQUITECTURA DE INTEGRACIONES Y FUENTES DE DATOS

### 2.1 Plataformas de E-commerce (Fuentes de Ventas)

| Plataforma | Datos que extrae | Plan requerido |
|---|---|---|
| **TiendaNube** | Ordenes, productos vendidos, precios, clientes, datos de envio, historial 60 dias | Todos los planes |
| **Shopify** | Ordenes, productos, colecciones, datos de clientes, historial de compras | Todos los planes |
| **MercadoLibre** | Ordenes, comisiones de marketplace, productos, categorias | Desde plan Scale ($49/mes) |

### 2.2 Plataformas Publicitarias (Fuentes de Ad Spend)

| Plataforma | Datos que extrae | Acciones que permite | Plan requerido |
|---|---|---|---|
| **Meta/Facebook Ads** | Impresiones, gasto, ROAS reportado, campanas, conjuntos, anuncios individuales | Activar/pausar anuncios, ajustar presupuestos | Desde Growth ($19/mes) |
| **Google Ads** | Gasto publicitario, metricas de campanas | Solo lectura (tracking) | Desde Pro ($99/mes) |
| **TikTok Ads** | Gasto publicitario, metricas de campanas | Solo lectura (tracking) | Desde Pro ($99/mes) |

### 2.3 Pasarelas de Pago (Fuentes de Datos Financieros)

| Fuente | Datos implicitos que procesa |
|---|---|
| **Mercado Pago** | Comisiones variables por cuota, tarjeta, banco, promociones; plazos de acreditacion; tasas de financiacion |
| **Procesadores via Shopify/TiendaNube** | Comisiones de pago embebidas en las ordenes |

### 2.4 Permisos Especificos Solicitados a Meta

- `pages_show_list`: Identifica cuentas publicitarias vinculadas
- `pages_read_engagement`: Accede a metricas de contenido organico (likes, comments, reach, shares)
- `ads_management`: Obtiene Y MODIFICA datos de campanas (lectura + escritura)

### 2.5 Datos del Cliente Final que Recolecta

Segun su privacy policy:
- Nombre, email, telefono, direccion
- Geolocalizacion e IP
- Comportamiento de navegacion (browsing behavior)
- Datos de la tienda del propietario

---

## 3. METRICAS Y KPIs QUE CALCULA

### 3.1 Metricas de Rentabilidad (Core del Producto)

| Metrica | Formula/Logica | Granularidad |
|---|---|---|
| **Margen de Contribucion** | Precio de venta - Costos Variables (producto + envio + comisiones pago + ads + devoluciones) | Por SKU, por pedido, por canal, por periodo |
| **Profit Neto** | Margen de Contribucion - Costos Fijos (sueldos, alquiler, herramientas, servicios) | Diario, semanal, mensual |
| **Margen Real por SKU** | Ingresos cobrados del SKU - todos los costos variables atribuibles a ese SKU | Por producto individual |
| **Margen Real por Canal** | Diferenciado entre TiendaNube, MercadoLibre, ventas organicas, ventas por Ads | Por canal de venta |
| **Punto de Equilibrio** | Gastos Fijos / Margen de Contribucion por Unidad | Mensual |

### 3.2 Metricas de Performance Publicitario

| Metrica | Formula/Logica | Diferenciador |
|---|---|---|
| **True ROAS** | (Ingresos reales - TODOS los costos variables) / Gasto en Ads | Incluye costos de producto, envio, comisiones, devoluciones (no solo revenue/ad spend como Meta reporta) |
| **Blended ROAS** | Ingresos totales (todos los canales) / Gasto total en Ads (Meta + Google + TikTok) | Vision unificada sin atribucion por canal |
| **ROAS por Campana** | Margen neto atribuible a la campana / Gasto de esa campana | Por campana individual, por conjunto, por anuncio |
| **Profit Neto por Campana** | Ingreso atribuido - costos variables - porcion de ad spend | Rentabilidad neta, no solo retorno |

### 3.3 Metricas de Cashflow

| Metrica | Logica |
|---|---|
| **Predictor de Cashflow** | Proyecta CUANDO y CUANTO se cobrara cada venta segun el medio de pago (1 pago, 3 cuotas, 6 cuotas, 12 cuotas, etc.) |
| **Calendario de Acreditacion** | Mapea fechas concretas de acreditacion segun Mercado Pago: plazos reales por tipo de tarjeta, banco y cuota |
| **Simulacion de Cuotas** | Calcula el impacto financiero de vender en 3/6/12/18/24 cuotas sobre el margen |

### 3.4 Metricas de Clientes (Plan Pro)

| Metrica | Descripcion |
|---|---|
| **Analisis de Cohortes** | Agrupa clientes por fecha de adquisicion y trackea comportamiento en el tiempo |
| **LTV (Lifetime Value)** | Valor estimado del cliente en el tiempo |
| **Segmentacion** | Clasificacion de clientes por comportamiento de compra |

### 3.5 Metricas Operativas

| Metrica | Descripcion |
|---|---|
| **Costo real de envio por zona** | Variable segun zona geografica, peso volumetrico, operador logistico |
| **Costo de devoluciones** | Logistica doble + producto perdido + tiempo del equipo |
| **Stock muerto** | Capital inmovilizado sin rotacion |

---

## 4. LOGICA DE CRUCE DE DATOS ENTRE FUENTES

### 4.1 Motor de Calculo de Rentabilidad Real

Escalafy cruza datos de multiples fuentes para llegar a un unico numero: **ganancia real**.

```
INGRESO BRUTO (de TiendaNube/Shopify/MercadoLibre)
  - Costo de producto (ingresado por el usuario o importado)
  - Comisiones de pago (calculadas automaticamente segun medio de pago)
  - Costo de envio real (variable por zona, peso, operador)
  - Comisiones de marketplace (MercadoLibre)
  - Costo de publicidad atribuido (de Meta/Google/TikTok via Track IA)
  - Devoluciones y recambios
  - Descuentos aplicados
  = MARGEN DE CONTRIBUCION
  - Costos fijos prorrateados
  = PROFIT NETO REAL
```

### 4.2 Cruce Plataforma de Venta <> Plataforma Publicitaria

1. El pixel Track IA se instala en la tienda (TiendaNube/Shopify)
2. Registra TODO el customer journey desde el primer click hasta la compra
3. Atribuye la venta a la campana/conjunto/anuncio especifico de Meta
4. Cruza ese dato con los costos reales de la orden (producto, envio, comisiones)
5. Resultado: ROAS calculado sobre margen neto, no sobre ingreso bruto

### 4.3 Cruce Ventas <> Pasarela de Pago

1. Identifica el medio de pago usado en cada orden
2. Aplica la comision REAL de Mercado Pago (que varia por: tipo de tarjeta, cantidad de cuotas, banco emisor, promociones vigentes)
3. Calcula el plazo de acreditacion real
4. Proyecta la fecha exacta en que el dinero estara disponible

### 4.4 Cruce Multi-canal (TiendaNube + MercadoLibre)

1. Unifica las ordenes de ambas plataformas en un solo dashboard
2. Aplica estructuras de costos DIFERENTES para cada canal:
   - TiendaNube: comisiones de pago directas
   - MercadoLibre: comision de marketplace + comision de envio + comision de pago
3. Permite comparar rentabilidad REAL entre canales

---

## 5. TIPOS DE ANALISIS

### 5.1 Analisis Descriptivo (Que paso)
- Dashboard de profit real en tiempo real (actualizado minuto a minuto)
- Margen por pedido, por SKU, por canal, por campana
- Visualizacion de costos desglosados
- Historial de rentabilidad por periodo

### 5.2 Analisis Diagnostico (Por que paso)
- Deteccion de "fugas financieras": ventas que parecen rentables pero no lo son
- Identificacion de SKUs deficitarios
- Deteccion de campanas publicitarias que generan ventas a perdida
- Identificacion de zonas de envio que destruyen margenes
- Deteccion de descuentos mal aplicados que erosionan rentabilidad

### 5.3 Analisis Predictivo (Que va a pasar)
- **Predictor de Cashflow**: Proyecta flujo de caja futuro basado en:
  - Ventas en cuotas pendientes de acreditacion
  - Plazos de liquidacion de pasarelas (7, 14, 30 dias)
  - Gastos publicitarios recurrentes (cobro diario de Meta/Google)
  - Pagos a proveedores programados

### 5.4 Analisis Comparativo
- ROAS de Escalafy (True ROAS) vs ROAS reportado por Meta
- Rentabilidad por canal (TiendaNube vs MercadoLibre vs Shopify)
- Rentabilidad por campana publicitaria
- Escalafy vs Excel (automatizado vs manual)

### 5.5 Analisis de Cohortes (Plan Pro)
- Segmentacion de clientes por fecha de adquisicion
- Tracking de comportamiento de recompra en el tiempo
- Calculo de LTV por cohorte

---

## 6. OUTPUTS: DASHBOARDS, REPORTES Y ACCIONES

### 6.1 Dashboard Principal de Rentabilidad
- Profit neto diario/semanal/mensual en tiempo real
- Desglose de costos por categoria
- Margen por SKU
- Margen por canal de venta
- Actualizado minuto a minuto

### 6.2 Dashboard de Meta Ads (Control Integrado)
- ROAS real por campana/conjunto/anuncio
- Comparativa True ROAS vs ROAS de Meta
- **Acciones directas desde Escalafy**:
  - Activar/pausar anuncios
  - Ajustar presupuestos
  - Sin necesidad de salir de la plataforma

### 6.3 Predictor de Cashflow
- Calendario visual de acreditaciones futuras
- Proyeccion de cobros por medio de pago
- Simulacion del impacto de cuotas en el flujo

### 6.4 Reportes de Atribucion (Track IA)
- Customer journey completo: primer click hasta compra
- Atribucion de ventas a campanas especificas
- Deteccion de conversiones que Meta pierde (post iOS 14)

### 6.5 Analisis por Producto/SKU
- Ranking de productos por rentabilidad real
- Identificacion de productos que generan perdida
- Margen unitario considerando todos los costos

### 6.6 Exportacion de Datos
- Exportacion de datos (mencionado en features)
- Dashboards customizables
- Analisis historico ilimitado (todos los planes)

---

## 7. SISTEMA DE TRACKING PROPIO: TRACK IA

### 7.1 Que es
Un pixel de atribucion propio que Escalafy instala en la tienda del usuario. Funciona como alternativa/complemento al pixel de Meta.

### 7.2 Problema que resuelve
Desde iOS 14 (2021), Meta perdio visibilidad sobre ~50% de las conversiones. Track IA trackea el 100% de las conversiones de forma independiente.

### 7.3 Como funciona
1. Se instala automaticamente al conectar la tienda (setup en ~10 minutos)
2. Registra el primer click del usuario (UTM, fuente, campana)
3. Sigue el journey del usuario en la tienda
4. Registra la conversion (compra)
5. Atribuye la venta a la fuente/campana/anuncio original
6. Cruza con datos de costos para calcular True ROAS

### 7.4 Disponibilidad
- Disponible desde el plan Growth ($19/mes)
- Solo para Meta Ads en planes Growth y Scale
- Google Ads y TikTok Ads desde plan Pro ($99/mes)

---

## 8. ESTRUCTURA DE COSTOS AUTOMATIZADA

### 8.1 Costos Variables que Calcula Automaticamente

| Costo | Fuente de datos | Logica |
|---|---|---|
| Costo de producto | Ingresado por el usuario | Asociado a cada SKU |
| Comisiones de Mercado Pago | API de la plataforma de venta | Variable por: tipo de tarjeta, cuotas, banco, promociones |
| Costo de envio | Orden de la plataforma | Variable por: zona, peso, operador logistico |
| Comision de MercadoLibre | API de MercadoLibre | Por categoria, tipo de publicacion, envio |
| Gasto publicitario | APIs de Meta/Google/TikTok | Gasto real por campana, atribuido por Track IA |
| Devoluciones | Registro de la plataforma | Logistica doble + producto perdido |
| Descuentos/cupones | Orden de la plataforma | Descuento real aplicado por pedido |

### 8.2 Costos Fijos que el Usuario Configura
- Sueldos y equipo
- Alquiler/oficina
- Herramientas SaaS
- Servicios (internet, telefono)
- Honorarios profesionales (contador, abogado)
- Fees de agencia

### 8.3 Los 9 "Costos Ocultos" que Escalafy Detecta

1. **Cuotas y financiacion**: Pueden comerse 20-35% del margen de un SKU
2. **Comisiones variables**: Fluctuan segun banco, fecha, tarjeta y promociones
3. **Envios a zonas caras**: Ciertas regiones destruyen margenes sin que se note
4. **Devoluciones**: Perdida doble (producto + logistica + tiempo)
5. **Recambios**: Parecen ventas pero generan perdidas
6. **Descuentos mal aplicados**: Black Friday puede "romper tu mes entero"
7. **Ads mal atribuidos**: Campanas sin ventas reales verificadas
8. **Stock muerto**: Capital inmovilizado sin retorno
9. **Promedios falsos en Excel**: Calculos promediados que "mienten"

---

## 9. MODELO DE PRICING Y SEGMENTACION POR FEATURES

| Plan | Precio/mes | Ordenes/mes | Features clave |
|---|---|---|---|
| **Free** | $0 | Hasta 50 | Integracion basica, soporte por email |
| **Growth** | $19 (promo $16) | 50-300 | Control de Meta Ads, Pixel Track IA, soporte prioritario |
| **Scale** | $49 | 300-900 | + Integracion MercadoLibre, Predictor de Cashflow |
| **Pro** | $99 | Ilimitado | + Google/TikTok Ads, Analisis de cohortes, WhatsApp 24/7 |

- Todos los planes incluyen historial de datos ilimitado
- Facturacion anual con 17% de descuento
- Setup automatico en 10 minutos

---

## 10. FRAMEWORK CONCEPTUAL DE 4 CAPAS

Escalafy estructura su logica de negocio en 4 capas progresivas:

### Capa 1: Vanity Metrics
- Visitas, seguidores, engagement
- Utiles para marketing, NO para decisiones financieras
- Escalafy NO se enfoca aqui

### Capa 2: Ingreso Bruto
- Ventas totales reportadas por las plataformas
- Sin deduccion de costos
- "Lo que Tiendanube y MercadoLibre te muestran"

### Capa 3: Margen de Contribucion (CAPA CRITICA)
- Revenue cobrado - Costos Variables - Ad Spend
- "Donde emerge la verdad"
- El core de lo que Escalafy automatiza

### Capa 4: Rentabilidad Neta
- Margen de Contribucion - Costos Fijos
- La respuesta final: "ganas o perdes plata?"

---

## 11. DIFERENCIADORES VS COMPETENCIA

### vs TripleWhale
- TripleWhale mide MARKETING performance; Escalafy mide RENTABILIDAD financiera
- TripleWhale para USA/Europa; Escalafy para LATAM
- TripleWhale integra Shopify/Stripe; Escalafy integra TiendaNube/ML/Mercado Pago
- Escalafy considera variables LATAM: cuotas, inflacion, logistica variable

### vs Prax Analytics
- Prax tiene RFM fuerte (segmentacion de clientes) y es para Brasil (Bling, Olist, Tiny, Tray)
- Escalafy tiene precision financiera argentina (cuotas Mercado Pago, comisiones escalonadas)
- Prax actualiza cada 24h; Escalafy en tiempo real
- Escalafy reemplaza Excel financiero; Prax complementa analytics

### vs Estadisticas Nube (nativo de TiendaNube)
- Estadisticas Nube describe COMPORTAMIENTO de usuarios
- Escalafy determina si el NEGOCIO GANA DINERO
- Estadisticas Nube no tiene costos, margenes, ni rentabilidad
- Escalafy agrega: costos reales, margenes por SKU, ROAS real, cashflow

### vs Excel
- Excel usa promedios; Escalafy usa datos reales por pedido
- Excel no se actualiza en tiempo real
- Excel no puede capturar comisiones variables de Mercado Pago dinamicamente
- Excel no cruza datos de ventas con ads automaticamente

---

## 12. LIMITACIONES IDENTIFICADAS

1. **Solo en espanol**: Sin soporte para mercados anglosajones
2. **MercadoLibre solo desde plan Scale ($49/mes)**: Barrera para vendedores multicanal pequenos
3. **Google y TikTok Ads solo en plan Pro ($99/mes)**: Limita atribucion multicanal
4. **No documentan algoritmos de atribucion**: No especifican si usan first-click, last-click, multi-touch
5. **No tienen API publica documentada**: No se puede integrar con herramientas externas
6. **Predictor de cashflow**: No documentan el modelo estadistico/predictivo que usan
7. **Sin integraciones con ERPs o sistemas contables**: No conecta con herramientas como Xero, QuickBooks, Colppy
8. **Sin integraciones con logistica**: No se conecta directamente con operadores logisticos (Andreani, OCA, etc.)
9. **Analisis de cohortes/LTV solo en plan Pro**: Feature critica bloqueada tras paywall alto
10. **Privacy policy basica**: Email de contacto personal (gmail), lo cual sugiere operacion temprana/lean

---

## 13. DATOS TECNICOS SOBRE RECOLECCION DE DATOS

### Datos del Customer Final que Accede
- Nombre, email, telefono, direccion
- Geolocalizacion e IP
- Comportamiento de navegacion
- Productos visualizados, colecciones navegadas
- Historial de ordenes (60 dias)
- Datos de envio completos

### Politica de Datos
- No venden, alquilan ni comparten datos con terceros no afiliados
- Procesamiento de solicitudes de eliminacion en 30 dias
- Contacto: mateofucciwd@gmail.com

---

## 14. RESUMEN EJECUTIVO: LA LOGICA DE NEGOCIO COMPLETA

Escalafy funciona como un **controlador financiero automatizado para e-commerce LATAM** que:

1. **CONECTA** todas las fuentes de datos del negocio (tiendas, marketplaces, ads, pagos)
2. **CALCULA** costos reales por pedido (no promedios) considerando las complejidades del mercado LATAM (cuotas variables, comisiones dinamicas, zonas de envio)
3. **CRUZA** datos de ventas con datos publicitarios via pixel propio (Track IA) para atribucion independiente
4. **DETERMINA** rentabilidad real a nivel de SKU, canal, campana y negocio total
5. **PROYECTA** cashflow futuro basado en estructura de cuotas y plazos de acreditacion
6. **PERMITE ACTUAR** sobre campanas de Meta directamente desde el dashboard

El diferenciador real no es la sofisticacion analitica (no tiene modelos predictivos avanzados ni ML visible), sino la **automatizacion de un calculo que en LATAM es extremadamente complejo** por la variabilidad de comisiones, cuotas, y costos logisticos. Resuelve un dolor real: el founder que factura mucho pero no sabe si gana plata.
