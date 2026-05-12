# Análisis de creativos · pendiente de definir

> Doc de research abierto. Lo que sigue son preguntas a resolver antes de
> volver a poner el sistema de recomendaciones (Escalar / Pausar / etc.) en
> la página de Creativos.

## Decisión actual (2026-05-12)

El sistema de **clasificación por ángulo** se mantiene visible y útil
(Performance por ángulo + Lectura del mensaje en el modal), pero las
**recomendaciones automáticas se quitaron** porque generaban señales
falsas: sugerían pausar anuncios con 1-3 días de vida o sin masa crítica
de spend, ignorando madurez de muestra.

Los análisis se cargan **manualmente** (seeds en MongoDB) o vía script
batch — no se dispara llamada a Claude desde el botón de la UI. El
endpoint `POST /creativos/analyze` queda disponible para tooling
operativo pero no se invoca desde el frontend.

---

## Preguntas a resolver antes de recomendar acciones

### 1. Ventana mínima de muestreo

¿Cuánto tiempo / cuánto spend tiene que tener un ad antes de poder evaluarlo?

- ¿Es lo mismo evaluar al día 1 vs al día 7 vs al día 30?
- ¿Importa el spend absoluto o el spend relativo al budget del adset?
- ¿La frecuencia juega (no podemos juzgar un ad que recién llegó a frecuencia 0.5x)?

**Hipótesis a probar:** mínimo 3 días de spend continuo Y spend ≥ 3x el CPA promedio
de la cuenta antes de emitir cualquier juicio.

### 2. Diferenciación por tienda

Los thresholds que valen para Límite Deportes (ticket alto, calzado, AOV ~$95k)
no valen para una tienda de indumentaria premium o una de electrónica.

- **ROAS objetivo**: depende del margen real de cada tienda
- **CTR baseline**: depende de la categoría e industria
- **CPA aceptable**: depende del LTV de cada tienda
- **Estructura de costos**: tiendas con comisiones altas (cuotas, MP) toleran
  menos ROAS bajo

**Hipótesis:** los thresholds deberían vivir en `store.creativosConfig`
o derivarse automáticamente del `targetService` que ya calcula breakeven ROAS.

### 3. Diferenciación por objetivo de campaña

Un ad de `outcome_engagement` no debe juzgarse con la misma vara que uno
de `outcome_sales`. El de engagement no tiene por qué generar compras directas.

- Sales: ROAS, CPA, compras
- Traffic: CPC, CTR, landing page views
- Engagement: thruplays, interacciones, alcance
- Awareness: CPM, alcance, frecuencia

### 4. Construcción iterativa por cliente

Cada tienda tiene un perfil de éxito propio. La construcción no puede ser
genérica.

- ¿Hooks aprende del histórico de la tienda (qué le funcionó en el pasado)?
- ¿Se calibra contra los Top 10% históricos de cada tienda?
- ¿El usuario marca manualmente "este es un ganador" y el sistema aprende?

### 5. Qué hacer con ángulos infrarrepresentados

En Límite hoy, "Producto + urgencia" tiene 3 ads y $29k spend. Eso es
demasiado poco para decir "funciona". Pero también podría ser que es el
ganador pero todavía no se le dio chance.

- ¿Cuándo decimos "esto rinde mal" vs "todavía no rindió porque no le diste data"?
- ¿Cómo se mide la falta de oportunidad?

---

## Lo que SÍ se sigue mostrando (sin recomendar)

- **Galería de ads** con tier (A-E) heredado del autoclassifier existente
- **Filtros** por status, tier, spend
- **Comparador lado-a-lado** con highlights del ganador en cada métrica (es factual, no recomienda)
- **Tabla de ángulos** con métricas agregadas (sin columna "Recomendación")
- **Modal de lectura del mensaje** con tags clasificadores y rationale descriptivo (sin "pausar este ad")

## Próximos pasos (cuando arranquemos esta línea de nuevo)

1. Definir el modelo de evaluación con Lucas — sentarse y bajar a criterios concretos
2. Probablemente arrancar con UNA tienda (Límite) y construir todo a medida
3. Recién después generalizar para multi-tienda
