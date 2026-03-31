# Hooks MCP para Claude

Servidor MCP local `read-only` para que Claude Code o Claude Desktop tengan acceso directo al contexto de Hooks Analytics.

## Qué expone

### Tools
- `list_stores`
- `get_store_overview`
- `get_sync_status`
- `get_ai_context_snapshot`
- `get_creative_pipeline`
- `get_commercial_overview`
- `get_reports`
- `get_financial_consistency`
- `create_report`
- `save_analysis`
- `create_team_note`

### Resources
- `hooks://stores`
- `hooks://stores/{storeId}/overview?from={from}&to={to}`
- `hooks://stores/{storeId}/sync-status?from={from}&to={to}`
- `hooks://stores/{storeId}/creative-pipeline?from={from}&to={to}`
- `hooks://stores/{storeId}/commercial?from={from}&to={to}`
- `hooks://stores/{storeId}/financial-consistency?from={from}&to={to}`
- `hooks://stores/{storeId}/ai-context?section={section}&from={from}&to={to}`
- `hooks://stores/{storeId}/reports?limit={limit}`

### Prompts
- `analizar_negocio`
- `auditar_sync`
- `revisar_pipeline_creativo`

## Cómo correrlo localmente

Desde el backend:

```bash
cd "/Users/lucasvargas/Desktop/ANALISIS ECOM/Hooks-analytics/backend"
npm run mcp
```

## Claude Code

Agregar el servidor MCP:

```bash
claude mcp add hooks-analytics -- node "/Users/lucasvargas/Desktop/ANALISIS ECOM/Hooks-analytics/backend/src/mcp/hooksMcpServer.js"
```

Después, en Claude Code, vas a poder:
- listar tiendas
- leer recursos `hooks://...`
- usar prompts MCP

Ejemplos:
- `Usá list_stores y decime qué tiendas hay`
- `Usá get_sync_status para MANGUZ y auditá integridad`
- `Usá get_creative_pipeline para Limite Deportes del 2026-03-01 al 2026-03-30`

## Claude Desktop

Agregar el server MCP en la configuración de Claude Desktop:

```json
{
  "mcpServers": {
    "hooks-analytics": {
      "command": "node",
      "args": [
        "/Users/lucasvargas/Desktop/ANALISIS ECOM/Hooks-analytics/backend/src/mcp/hooksMcpServer.js"
      ]
    }
  }
}
```

## Notas

- Expone lectura y tres escrituras seguras:
  - guardar reportes
  - guardar análisis
  - crear notas internas
- No dispara syncs ni modifica configuraciones sensibles.
- Usa la misma base Mongo y `.env` del backend de Hooks.
- Si Mongo o integraciones no están accesibles, Claude va a ver el error real.
- El mejor uso inicial es:
  - auditoría de sync
  - análisis ejecutivo
  - revisión creativa
  - chequeos de consistencia

## Autoría de las escrituras

Las escrituras MCP se guardan usando:

1. `MCP_DEFAULT_AUTHOR_EMAIL` si existe en `.env`
2. si no, el primer usuario `admin` activo

Por defecto conviene usar:

```env
MCP_DEFAULT_AUTHOR_EMAIL=lucas@hooks.com.ar
```

## Claude Code / Claude Desktop / Claude.ai

- **Claude Code**: sí, funciona muy bien con este MCP local.
- **Claude Desktop**: sí, también puede usar este MCP local por comando.
- **Claude.ai web**: depende de conectores MCP habilitados para tu plan/equipo. Para uso local con `stdio`, Claude Code y Claude Desktop son el camino más directo y confiable.
