# ANALISIS EXHAUSTIVO: MASTER METRICS
## Plataforma de Analytics y Reporteria para Marketing y Ventas

**URL:** https://mastermetrics.com/
**Fundada:** 2022 | **Sede:** Argentina
**Tipo:** SaaS Cloud-based (Next.js frontend, AWS backend)
**Infraestructura:** Amazon Web Services (almacenamiento en EEUU, backups en Irlanda)
**Target:** Agencias de marketing digital, equipos internos de marketing, freelancers

---

## 1. ARQUITECTURA DE LA PLATAFORMA

Master Metrics es una plataforma de consolidacion, visualizacion y automatizacion de datos de marketing digital y ventas. No es una herramienta de BI generica, sino un producto vertical diseñado especificamente para agencias y equipos de performance marketing.

### Subdominios de la plataforma:
- `app.mastermetrics.com` - Aplicacion principal (login/registro)
- `dashboards.mastermetrics.com` - Motor de dashboards
- `overviews.mastermetrics.com` - Modulo Overview
- `help.mastermetrics.com` - Centro de ayuda (27 articulos en EN/ES/PT)
- `blog.mastermetrics.com` - Blog educativo
- `wp.mastermetrics.com` - Sitio WordPress auxiliar

---

## 2. MODULOS FUNCIONALES

La plataforma tiene **6 modulos principales**:

### 2.1. OVERVIEW (Tabla de Control Multi-Cuenta)
### 2.2. DASHBOARDS (Paneles Visuales)
### 2.3. ALERTAS (Sistema de Notificaciones)
### 2.4. SLIDES (Presentaciones con IA)
### 2.5. EXPORT/IMPORT (Conectores Google Sheets y Looker Studio)
### 2.6. DATA SOURCES (Fuentes de Datos)

---

## 3. MODULO OVERVIEW - ANALISIS DETALLADO

### 3.1. Que es
Una tabla tipo spreadsheet que consolida TODOS los datos de TODOS los clientes/cuentas publicitarias en una unica vista. Funciona como un "centro de comando" donde un analista puede ver el estado de todas las cuentas que gestiona sin entrar a cada plataforma individual.

### 3.2. Dos vistas disponibles
- **Overview by Client:** Filas = clientes, columnas = metricas de distintas plataformas
- **Overview by Campaign:** Filas = campañas individuales, columnas = metricas

### 3.3. Fuentes de datos que alimentan el Overview
Metricas directas de:
- Meta Ads (Facebook/Instagram Ads)
- Google Ads
- LinkedIn Ads
- TikTok Ads
- YouTube Ads
- Bing Ads (Microsoft Advertising)
- Pinterest Ads
- Google Analytics 4
- Facebook Insights (organico)
- Instagram Insights (organico)
- Google My Business
- Marketing Nube
- CRMs: HubSpot, Pipedrive, Kommo, Close, Go High Level

### 3.4. Metricas nativas por plataforma
La tabla ofrece un campo "Add Metric" que despliega una lista de metricas disponibles POR PLATAFORMA. Ejemplos tipicos:
- **Ads:** Impresiones, clics, CPC, CTR, conversiones, tasa de conversion, CPA, ROAS, gasto/inversion, CPM, alcance, frecuencia
- **Analytics:** Sesiones, usuarios, pageviews, bounce rate, duracion de sesion, conversiones web
- **CRM:** Leads creados, oportunidades, deals ganados, valor de pipeline, tasa de cierre
- **Social organico:** Alcance, interacciones, seguidores ganados, vistas de video

### 3.5. Campos personalizados (Custom Fields)
Este es uno de los diferenciadores clave. Ademas de las metricas que vienen de las APIs, se pueden crear columnas manuales de 9 tipos:

| Tipo de campo | Uso | Ejemplo |
|---|---|---|
| **Single Text** | Notas cortas | "Campaña en pausa por cliente" |
| **Long Text** | Notas detalladas | Comentarios de analisis mensual |
| **URL** | Links a materiales | Link a brief, carpeta Drive |
| **Fecha** | Fechas relevantes | Inicio/fin de campaña, fecha de pago |
| **Numerico** | Valores manuales | Meta de ventas, presupuesto mensual, objetivo de leads |
| **Formula** | Calculos cruzados | Sumar conversiones de Meta + Google, calcular % de presupuesto ejecutado |
| **Seleccion simple** | Categorias | Analista responsable, estado de cuenta |
| **Seleccion multiple** | Tags multiples | Servicios contratados, plataformas activas |
| **Checkbox** | Validaciones binarias | "Brief entregado", "Factura enviada" |
| **Source Result** | Metrica variable por cliente | Seleccionar la metrica mas relevante por cada cliente en una sola columna |
| **CRM** | Datos de CRM | Metricas de HubSpot, Close, Kommo o Pipedrive con filtros y rango de fechas |

### 3.6. Operaciones sobre columnas
- **Alias:** Renombrar metricas (ej: mostrar "Inversion FB" en vez de "Amount Spent")
- **Comparativa:** Activar variacion porcentual vs periodo anterior automaticamente
- **Visibilidad:** Ocultar/mostrar columnas
- **Anclaje (Pin):** Fijar columnas para scroll horizontal
- **Redimensionar:** Ancho de columna ajustable
- **Reordenar:** Arrastrar columnas
- **Ordenar:** Ascendente/descendente por cualquier metrica

### 3.7. Totales automaticos
Opcion "Include Totals" que genera una fila de totalizacion para todas las metricas seleccionadas.

### 3.8. Sistema de filtros
Los filtros operan sobre TODA la informacion de la tabla (metricas de plataformas + campos personalizados). Ejemplos:
- Clientes con mas de X conversiones
- Clientes con inversion mayor a $X en Meta
- Clientes asignados a un analista especifico
- Clientes que gastaron mas del X% del presupuesto
- Filtrar por estado (activo, pausado, etc.)

### 3.9. Formato condicional
Sistema de colores tipo semaforo configurable por columna:
- Definir condiciones (ej: si CPA > $20, pintar rojo)
- Destacar visualmente metricas criticas
- Identificar cuentas que necesitan atencion inmediata

### 3.10. Filtro de fechas global
La tabla siempre tiene un filtro de fecha. Cambiar el rango recalcula TODAS las metricas automaticamente.

### 3.11. Tipo de analisis del Overview
- **Descriptivo:** Muestra el estado actual de todas las cuentas
- **Comparativo:** Comparacion vs periodo anterior (activable por columna)
- **Operativo:** Identifica que cuentas necesitan atencion inmediata via formato condicional y filtros

---

## 4. MODULO DASHBOARDS - ANALISIS DETALLADO

### 4.1. Que es
Paneles visuales personalizables que muestran datos de una o multiples cuentas publicitarias con widgets graficos.

### 4.2. Fuentes de datos
Las mismas 20+ integraciones del Overview, pero aplicadas a nivel de cuenta individual o agrupadas.

### 4.3. Componentes de dashboard disponibles
Segun la documentacion y reviews:
- Scorecards (KPIs individuales con numero grande)
- Graficos de lineas (tendencias temporales)
- Graficos de barras (comparativos)
- Tablas de datos
- Imagenes de anuncios (traer las creatividades directamente al dashboard)
- Widgets de texto/notas

### 4.4. Metricas calculadas (Calculated Metrics)
Sistema de formulas que permite crear metricas CRUZANDO datos de diferentes fuentes:

**Operaciones soportadas:** +, -, x, ÷, parentesis
**Ejemplos documentados:**
- `Total Inversion = Meta Spend + Google Ads Spend + TikTok Spend + LinkedIn Spend`
- `CPA Total = Total Inversion / Total Conversiones`
- `ROAS Global = Revenue / Total Inversion`
- `Tasa de Conversion Pipeline = Opportunities Won / Opportunities Created` (datos CRM)
- `Costo por Lead Calificado = Total Spend / CRM Qualified Leads`
- `Presupuesto Restante = Budget Manual - Total Spend`
- `Gasto Diario Necesario = Presupuesto Restante / Dias Restantes del Mes`

**Logica de cruce de datos:** Las formulas pueden combinar metricas de CUALQUIER fuente conectada. Esto significa que un ROAS real puede calcularse tomando el revenue de Shopify/TiendaNube y dividiendolo por el spend de Meta + Google, algo que ninguna plataforma individual puede hacer nativamente.

### 4.5. Templates
- Plantillas prediseñadas para arrancar rapido
- Clonacion de dashboards con un clic para nuevas cuentas
- Al clonar, solo se cambia la fuente de datos; la estructura se mantiene

### 4.6. Compartir dashboards
- **Links publicos:** URL compartible sin necesidad de login
- **Exportacion PDF:** Generar PDF del dashboard
- **Reportes por email programados:** Envio automatico periodico (semanal, quincenal, mensual)
- **Filtros de fecha en reportes compartidos:** El receptor puede cambiar el rango de fechas

### 4.7. Tipo de analisis de Dashboards
- **Descriptivo:** Estado actual de metricas clave
- **Comparativo:** Comparacion entre periodos
- **Cross-platform:** Metricas calculadas que cruzan datos de multiples fuentes
- **Tendencia temporal:** Graficos de linea que muestran evolucion

---

## 5. MODULO ALERTAS - ANALISIS DETALLADO

### 5.1. Que es
Sistema de monitoreo automatico que notifica cuando metricas superan o caen por debajo de umbrales definidos.

### 5.2. Tipos de alertas documentados

**Alertas de presupuesto:**
- Control del gasto diario necesario para alcanzar el presupuesto mensual
- Notificacion cuando estas por encima o por debajo de un % especifico del presupuesto diario
- Ejemplo: "Si el gasto de hoy supera el 120% del gasto diario promedio necesario, alertar"

**Alertas de metricas:**
- Notificacion cuando cualquier metrica supera un valor determinado
- Ejemplo: "Si CPA de Google Ads supera $25, alertar"
- Ejemplo: "Si CTR cae por debajo de 1%, alertar"
- Ejemplo: "Picos de gasto inesperados"

**Alertas de objetivos:**
- Comparacion de conversiones actuales vs target de conversiones
- Comparacion de CPC actual vs CPC objetivo

### 5.3. Canales de notificacion
| Canal | Descripcion |
|---|---|
| **Email** | Alertas al inbox del analista |
| **Slack** | Mensajes directos o a canales especificos, soporta multiples workspaces |
| **WhatsApp** | Notificaciones instantaneas |
| **ClickUp** | Crear tareas automaticamente en el project manager |
| **Monday.com** | Crear items automaticamente |
| **Asana** | Crear tareas automaticamente |

### 5.4. Configuracion de alertas Slack (documentado paso a paso)
1. Conectar cuenta Slack desde Master Metrics
2. Ir a "Alerts Configuration" en el sidebar
3. Crear alerta definiendo: nombre, metrica, umbral, timeframe
4. Seleccionar workspace de Slack
5. Elegir entre mensaje directo o notificacion a canal
6. Soporta multiples workspaces simultaneamente

### 5.5. Integracion con Task Managers
Lo mas interesante: cuando una alerta se dispara, puede CREAR AUTOMATICAMENTE una tarea en ClickUp, Monday o Asana. Esto convierte la alerta en un flujo de trabajo accionable, no solo una notificacion pasiva.

### 5.6. Frecuencia de alertas
- **Planes Basic/Intermediate:** Alertas diarias
- **Planes Pro:** Alertas por hora (hourly)

### 5.7. Tipo de analisis de Alertas
- **Monitoreo en tiempo real/diario:** Deteccion de anomalias
- **Control presupuestario:** Proyeccion de gasto vs meta
- **Threshold-based:** Analisis basado en umbrales predefinidos

---

## 6. MODULO SLIDES (Presentaciones con IA) - ANALISIS DETALLADO

### 6.1. Que es
Generador automatico de presentaciones en Google Slides usando inteligencia artificial, diseñado para crear reportes de clientes en minutos.

### 6.2. Fuentes de datos soportadas para Slides
- Google Ads
- Facebook/Meta Ads
- Google Analytics 4

### 6.3. Proceso de generacion (documentado)
1. **Seleccionar fuente de datos** (ej: Google Ads) y la cuenta publicitaria
2. **Elegir tipo de negocio del cliente** y objetivo de campaña
3. **Seleccionar metrica objetivo** (Purchases, Reach, Leads, etc.)
4. **Personalizar diseño:** Logo de agencia, logo de cliente, colores, tipografia
5. **Seleccionar idioma:** Español, Ingles o Portugues
6. **Seleccionar periodo temporal:** Rango de fechas para el reporte
7. **La IA genera la presentacion** en segundos

### 6.4. Que genera la IA
- Slides con metricas clave segun el tipo de campaña y objetivo seleccionado
- Contenido adaptado al tipo de campañas del cliente
- Visualizaciones claras para no-especialistas
- Comparaciones con periodos anteriores
- Presentacion completamente editable en Google Slides

### 6.5. Funcionalidades clave
- **Creacion ilimitada:** Sin limite de presentaciones
- **Clonacion temporal:** Seleccionar presentacion existente, clonar, y solo cambiar el periodo = reporte actualizado en ~2 minutos
- **100% editable:** El output es un Google Slides normal que se puede modificar libremente
- **100% personalizable en diseño:** Branding completo de agencia + cliente
- **Multi-idioma:** ES, EN, PT

### 6.6. Metricas tipicas incluidas en los slides
- **Google Ads:** ROAS, CPA, conversiones, CTR, CPC, impresiones, clics
- **Meta Ads:** Alcance, interacciones, conversiones, costo por resultado
- **GA4:** Sesiones, usuarios, conversiones web, fuentes de trafico
- **Social media:** Reach, interacciones, clics, conversiones, seguidores ganados, vistas de video

### 6.7. Tipo de analisis de Slides
- **Descriptivo:** Resumen del periodo
- **Comparativo:** vs periodo anterior (automatico)
- **Narrativo:** La IA genera texto explicativo, no solo numeros

---

## 7. MODULO EXPORT/IMPORT - ANALISIS DETALLADO

### 7.1. Conector Google Sheets (Export)
- **Que hace:** Extrae datos de las fuentes conectadas y los vuelca en Google Sheets automaticamente
- **Frecuencia de actualizacion:**
  - Diaria (planes desde $69/mes)
  - Horaria (planes desde $899/mes, segun comparativa con Supermetrics)
- **Addon de Google Workspace:** Disponible en Google Workspace Marketplace (ID: 1098201451918)
- **Uso:** Alimentar hojas de calculo que luego se conectan a Looker Studio u otras herramientas de BI

### 7.2. Conector Looker Studio
- **Que hace:** Funciona como conector partner de Looker Studio para traer datos de fuentes que Looker no soporta nativamente (Meta Ads, TikTok, etc.)
- **Problema que resuelve:** Looker Studio solo tiene conectores nativos gratuitos para productos Google. Para Meta, TikTok, LinkedIn, CRM, etc., se necesita un conector de terceros como Master Metrics
- **Proceso:** Crear Data Source en Looker Studio > buscar conector Master Metrics > seleccionar metricas y dimensiones a importar > construir reporte

### 7.3. Import Google Sheets a Master Metrics
- **Que hace:** Permite importar datos de Google Sheets HACIA Master Metrics
- **Uso:** Traer datos manuales o de fuentes no integradas nativamente para cruzarlos con datos de ads/analytics dentro de la plataforma

### 7.4. Exportacion adicional
- **Excel:** Exportar datos a formato Excel
- **PDF:** Exportar dashboards a PDF
- **Email programado:** Envio automatico de reportes

---

## 8. FUENTES DE DATOS (DATA SOURCES) - CATALOGO COMPLETO

### 8.1. Plataformas de publicidad digital (Ads)
| Plataforma | Estado | Datos tipicos |
|---|---|---|
| **Meta Ads** (Facebook + Instagram) | Activo | Spend, impressions, reach, clicks, CTR, CPC, CPM, conversions, CPA, ROAS, frequency |
| **Google Ads** | Activo | Spend, impressions, clicks, CTR, CPC, conversions, conversion rate, CPA, ROAS, quality score |
| **TikTok Ads** | Activo | Spend, impressions, clicks, CTR, CPC, conversions, video views |
| **LinkedIn Ads** | Activo | Spend, impressions, clicks, CTR, CPC, conversions, leads |
| **YouTube Ads** | Activo | Spend, views, CPV, impressions, clicks, CTR |
| **Bing Ads** (Microsoft Advertising) | Activo | Spend, impressions, clicks, CTR, CPC, conversions |
| **Pinterest Ads** | Activo | Spend, impressions, clicks, conversions |

### 8.2. Analytics web
| Plataforma | Estado | Datos tipicos |
|---|---|---|
| **Google Analytics 4** | Activo | Sessions, users, pageviews, bounce rate, session duration, conversions, events, traffic sources |
| **Google Search Console** | Proximo | Impressions, clicks, CTR, average position, queries, pages |

### 8.3. Redes sociales (organico)
| Plataforma | Estado | Datos tipicos |
|---|---|---|
| **Facebook Insights** | Activo | Reach, engagement, followers, post performance |
| **Instagram Insights** | Activo | Reach, impressions, engagement, followers gained, stories metrics |
| **Google My Business** | Activo | Views, searches, actions (calls, directions, website clicks) |
| **TikTok Organic** | Proximo | Video views, engagement, followers |
| **LinkedIn Organic** | Proximo | Post impressions, engagement, followers |

### 8.4. Ecommerce
| Plataforma | Estado | Datos tipicos |
|---|---|---|
| **Tienda Nube** | Activo | Ventas, ordenes, revenue, productos, clientes |
| **Shopify** | Activo | Ventas, ordenes, revenue, productos, clientes |
| **WooCommerce** | Activo | Ventas, ordenes, revenue, productos, clientes |
| **Marketing Nube** | Activo | Metricas de marketing de TiendaNube |

### 8.5. CRMs
| Plataforma | Estado | Datos tipicos |
|---|---|---|
| **Pipedrive** | Activo | Contacts, deals, organizations, leads, activities, notes, pipeline stages, deal values |
| **Kommo** | Activo | Leads, contacts, companies, pipeline metrics, conversion rates by stage |
| **Close** | Activo | Leads, opportunities, activities, revenue, pipeline |
| **HubSpot** | Activo | Contacts, deals, pipeline, marketing metrics |
| **Go High Level** | Activo | Contacts, opportunities, pipeline, automations |

### 8.6. Productividad y conectividad
| Plataforma | Estado | Datos tipicos |
|---|---|---|
| **Google Sheets** | Activo | Datos bidireccionales (import/export) |
| **Slack** | Activo | Canal de notificaciones de alertas |
| **ClickUp** | Activo | Creacion automatica de tareas desde alertas |
| **Monday.com** | Activo | Creacion automatica de items desde alertas |
| **Asana** | Activo | Creacion automatica de tareas desde alertas |
| **Zapier** | Activo | Automatizaciones con 5000+ apps |

### 8.7. Proximas integraciones
- TikTok Organic
- LinkedIn Organic
- Google Search Console
- Mercado Ads
- DV 360 (Display & Video 360)

---

## 9. LOGICA DE CRUCE DE DATOS ENTRE FUENTES

Este es el nucleo de valor de Master Metrics. La plataforma permite cruzar datos de diferentes fuentes de 3 maneras:

### 9.1. Metricas calculadas en Dashboards
Formulas que combinan metricas de distintas plataformas:
- **ROAS Real:** `Shopify Revenue / (Meta Spend + Google Spend + TikTok Spend)`
- **CPA Real (con datos CRM):** `Total Ad Spend / CRM Qualified Leads`
- **Conversion Rate Full Funnel:** `CRM Deals Won / Total Ad Clicks`
- **Blended CPL:** `(Meta Spend + Google Spend) / Total Leads (CRM)`

### 9.2. Formulas en Overview
Campos de tipo "Formula" en la tabla Overview que operan sobre TODAS las columnas:
- Sumar conversiones de todas las plataformas
- Calcular % de ejecucion presupuestaria
- Proyecciones de gasto basadas en dias restantes del mes

### 9.3. Source Result (Campo especial)
Permite seleccionar la metrica MAS RELEVANTE por cada cliente en una sola columna. Si un cliente solo usa Meta y otro solo Google, ambos pueden mostrar su metrica principal en la misma columna sin duplicar columnas.

### 9.4. CRM + Ads
La integracion con CRMs permite responder preguntas como:
- ¿Que campaña de ads genera mas leads CALIFICADOS? (no solo leads, sino los que avanzan en el pipeline)
- ¿Cual es el costo real por oportunidad ganada?
- ¿Cuantos leads genera cada vendedor por mes y cuantos convierte?
- ¿Cual es el ROAS real considerando ventas cerradas en CRM, no solo conversiones de pixel?

---

## 10. TIPOS DE ANALISIS QUE REALIZA

### 10.1. Analisis Descriptivo
- Estado actual de todas las metricas
- Resumen de performance por periodo
- Vista consolidada multi-cuenta y multi-plataforma

### 10.2. Analisis Comparativo
- Comparacion vs periodo anterior (activable por columna en Overview)
- Variacion porcentual automatica
- Comparacion entre plataformas (Meta vs Google vs TikTok)

### 10.3. Analisis de Control Presupuestario
- Gasto acumulado vs presupuesto mensual
- Gasto diario real vs gasto diario necesario para cumplir meta
- Proyeccion de cierre de mes basada en ritmo de gasto actual

### 10.4. Analisis de Alertas (Threshold-based)
- Deteccion de anomalias basada en umbrales predefinidos
- Alertas de picos de gasto
- Alertas de caida de performance

### 10.5. Analisis Cross-Platform
- Metricas unificadas que cruzan datos de multiples fuentes
- ROAS global, CPA global, conversion rates full-funnel
- Atribucion simplificada comparando fuentes de leads

### 10.6. Analisis Narrativo (via IA en Slides)
- La IA genera texto explicativo de las metricas, no solo numeros
- Adapta el lenguaje al tipo de campaña y objetivo
- Comparaciones automaticas con periodos anteriores

### 10.7. Analisis Predictivo (limitado)
- Segun SourceForge, la plataforma lista "Predictive Analytics" como feature
- Budgeting & Forecasting como categoria
- Proyeccion de gasto basada en ritmo actual (usando campos de fecha + formulas)
- No parece tener modelos ML sofisticados; la "prediccion" es mas bien proyeccion lineal

---

## 11. OUTPUTS QUE GENERA

### 11.1. Dashboards interactivos
- Paneles visuales en tiempo real (actualizacion diaria u horaria)
- Compartibles por link publico
- Con filtros de fecha funcionales para el receptor

### 11.2. Tabla Overview
- Vista tipo spreadsheet con toda la informacion consolidada
- Formato condicional tipo semaforo
- Filtros avanzados

### 11.3. Presentaciones Google Slides
- Generadas con IA en segundos
- Completamente editables
- Multi-idioma (ES/EN/PT)
- Clonables para actualizacion rapida

### 11.4. Reportes PDF
- Exportacion de dashboards a PDF
- Programables por email

### 11.5. Datos en Google Sheets
- Export automatico de datos a hojas de calculo
- Actualizacion diaria/horaria
- Datos listos para consumir en Looker Studio o Excel

### 11.6. Datos en Looker Studio
- Conector partner que alimenta reportes de Looker Studio
- Acceso a fuentes que Looker no soporta nativamente

### 11.7. Alertas accionables
- Notificaciones en Email, Slack, WhatsApp
- Creacion automatica de tareas en ClickUp, Monday, Asana

### 11.8. Reportes automatizados por email
- Envio programado de reportes a clientes o stakeholders
- Configurable por frecuencia (semanal, quincenal, mensual)

---

## 12. PLANES Y PRECIOS

### 12.1. Plan Freelancer - $30/mes
- 15 cuentas
- Alertas incluidas
- AI Slides incluido
- **NO incluye:** Looker Connector, Sheets Connector, Dashboards, Overview, Implementacion gratis

### 12.2. Plan Basic - $69/mes
- 15 cuentas
- 3 integraciones
- Actualizaciones diarias
- Looker Connector, Sheets Connector, Alertas, Dashboards, Overview, AI Slides
- Implementacion gratis

### 12.3. Plan Basic Plus - $129/mes
- 30 cuentas
- Todo lo del Basic

### 12.4. Plan Intermediate - $169/mes
- 50 cuentas
- 5 integraciones
- Todo lo del Basic

### 12.5. Plan Intermediate Plus - $229/mes
- 70 cuentas
- Todo lo del Intermediate

### 12.6. Plan Pro - $289/mes
- 100 cuentas
- 7 integraciones
- Alertas por hora (hourly)
- Todo lo del Intermediate

### 12.7. Plan Pro Plus 1 - $359/mes
- 150 cuentas
- 7+ integraciones

### 12.8. Plan Pro Plus 2 - $439/mes
- 250 cuentas
- 7+ integraciones

### 12.9. Planes personalizados
- 100+ cuentas
- Pricing custom

---

## 13. DIFERENCIADORES CLAVE vs COMPETENCIA

### 13.1. vs Supermetrics
| Aspecto | Master Metrics | Supermetrics |
|---|---|---|
| Dashboard visual propio | SI | NO (solo exporta datos) |
| Modulo Overview | SI | NO |
| Alertas configurables | SI | NO |
| Integracion con task managers | SI | NO |
| Reportes automatizados a clientes | SI | NO |
| Implementacion gratis | SI | NO |
| Soporte en español | SI | NO |
| Google Sheets desde | $69/mes | $299/mes |
| Soporte WhatsApp | SI | NO |

### 13.2. vs Looker Studio
| Aspecto | Master Metrics | Looker Studio |
|---|---|---|
| Precio | Desde $30/mes | Gratis |
| Conectores no-Google (Meta, TikTok, etc.) | Incluidos | Requiere conector pago ($) |
| Dashboard visual | SI (propio) | SI (mas flexible) |
| Overview multi-cuenta | SI | NO nativo |
| Alertas | SI | NO |
| AI Slides | SI | NO |
| Metricas calculadas cross-platform | SI | Limitado |
| Soporte | Chat, email, WhatsApp | Comunidad |

---

## 14. MODELO DE DATOS CONCEPTUAL

```
[Plataformas de Ads] ──────────┐
  - Meta, Google, TikTok,      │
    LinkedIn, YouTube,         │
    Bing, Pinterest            │
                               ▼
[Plataformas Analytics] ──► [MASTER METRICS ENGINE] ──► [Dashboards]
  - GA4, GMB                   ▲                    ──► [Overview Table]
                               │                    ──► [Alertas → Slack/Email/WA]
[CRMs] ───────────────────────┤                    ──► [AI Slides → Google Slides]
  - Pipedrive, HubSpot,       │                    ──► [Export → Google Sheets]
    Kommo, Close, GHL         │                    ──► [Conector → Looker Studio]
                               │                    ──► [PDF / Email Reports]
[Ecommerce] ──────────────────┤
  - Shopify, TiendaNube,      │
    WooCommerce                │
                               │
[Datos Manuales] ─────────────┘
  - Google Sheets import
  - Campos personalizados
  - Presupuestos, metas
```

---

## 15. API Y PERMISOS

### 15.1. Google APIs
- Cumple con Google API Services User Data Policy (Limited Use requirements)
- No entrena modelos de IA con datos de Google Workspace
- Solo accede a datos necesarios para funcionalidad core
- No transfiere ni vende datos a terceros

### 15.2. Permisos tipicos solicitados (Pipedrive como ejemplo)
- Acceso a: Contactos, Deals, Organizations, Leads, Activities, Notes

### 15.3. Almacenamiento
- AWS (Estados Unidos) con backups en Irlanda
- Encriptacion de contraseñas
- Acceso restringido basado en necesidad

---

## 16. PUBLICO OBJETIVO Y CASOS DE USO

### 16.1. Agencias de marketing digital (principal)
- Gestion de multiples cuentas de clientes
- Reporteria automatizada
- Control de presupuestos
- Presentaciones de resultados

### 16.2. Equipos internos de marketing
- Consolidacion de datos de todas las plataformas
- Dashboards para stakeholders internos
- Control de KPIs

### 16.3. Freelancers
- Plan economico ($30/mes)
- Presentaciones profesionales para clientes

### 16.4. Equipos de ventas (con CRM)
- Cruce de datos marketing + ventas
- Analisis de funnel completo
- ROI real basado en ventas cerradas

---

## 17. LIMITACIONES IDENTIFICADAS

Basado en reviews y analisis:

1. **No tiene analisis predictivo sofisticado** - Las "predicciones" son proyecciones lineales basadas en formulas, no modelos ML
2. **Interfaz mobile mejorable** - Mencionado en reviews como area de mejora
3. **Conectores limitados vs competidores enterprise** - 20-25 conectores activos vs 100+ de Supermetrics
4. **Sin atribucion multi-touch avanzada** - No reemplaza herramientas de atribucion dedicadas
5. **AI Slides limitado a 3 fuentes** - Solo Google Ads, Meta Ads y GA4 (no incluye TikTok, LinkedIn, etc.)
6. **Sin integracion nativa con email marketing** - No conecta con Mailchimp, ActiveCampaign, etc. (aunque se menciona vagamente)
7. **Actualizaciones horarias solo en plan Pro** ($289+/mes)
8. **Google Sheets horario muy caro** - $899/mes segun comparativa

---

## 18. STACK TECNOLOGICO

- **Frontend:** Next.js (React) con Styled Components
- **Hosting:** AWS (probablemente S3 + CloudFront para static, EC2/Lambda para API)
- **Fuentes:** HindGuntur, Outfit, Inter
- **Analytics propio:** Google Tag Manager (GTM-TJVNRPQ)
- **Soporte:** Intercom
- **Blog:** WordPress (wp.mastermetrics.com)
- **Dominio app:** app.mastermetrics.com

---

## 19. RESUMEN EJECUTIVO

Master Metrics es una plataforma argentina de consolidacion de datos de marketing digital y ventas diseñada ESPECIFICAMENTE para agencias. Su valor principal no esta en la sofisticacion analitica (no compite con herramientas de BI como Tableau o Power BI), sino en:

1. **Operatividad:** Ver el estado de TODAS las cuentas de TODOS los clientes en UNA tabla
2. **Cruce de datos simplificado:** Metricas calculadas que combinan Ads + Analytics + CRM + Ecommerce sin escribir codigo
3. **Automatizacion de reporteria:** Slides con IA, PDFs programados, exports a Sheets
4. **Alertas accionables:** No solo notifica, sino que crea tareas en project managers
5. **Accesibilidad de precio:** Significativamente mas barato que Supermetrics para el mismo caso de uso

La logica de negocio central es: **reducir el tiempo que un analista de agencia pasa recopilando datos manualmente de 10+ plataformas y armando reportes, automatizando todo el proceso en una unica herramienta integrada.**
