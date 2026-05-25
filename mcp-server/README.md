# LifeTrack MCP Server

Servidor Node.js que expone:
1. **MCP via stdio** → integración con Claude Desktop y Claude Code
2. **REST API en :3746** → sincronización con la PWA Android via WiFi

## Requisitos

- Node.js ≥ 18
- La computadora y el teléfono en la misma red WiFi

## Instalación

```bash
cd mcp-server
npm install
```

## Iniciar servidor

```bash
npm start
```

El servidor inicia la API REST Y el canal MCP simultáneamente.

## Configurar Claude Desktop

Edita `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lifetrack": {
      "command": "node",
      "args": ["C:/ruta/completa/pwa-app/mcp-server/server.js"]
    }
  }
}
```

## Configurar Claude Code

Crea `.mcp.json` en la raíz del proyecto:

```json
{
  "lifetrack": {
    "type": "stdio",
    "command": "node",
    "args": ["./mcp-server/server.js"]
  }
}
```

## Configurar la PWA Android

1. Encuentra tu IP local: `ipconfig` (Windows) o `ifconfig` (Mac/Linux)
2. En la app → Ajustes → URL Servidor MCP: `http://192.168.x.x:3746`
3. Toca "Sincronizar" — los datos se fusionan bidireccialmente

## Herramientas MCP disponibles

| Herramienta | Descripción |
|---|---|
| `get_daily_summary` | Resumen del día: calorías, agua, tareas, peso |
| `log_meal` | Registrar comida por nombre y calorías |
| `update_goals` | Actualizar metas (calorías, agua, peso) |
| `log_weight` | Registrar peso corporal |
| `log_water` | Registrar agua consumida |
| `predict_weight` | Predicción de peso basada en tendencia calórica |
| `get_micronutrient_status` | Estado de vitaminas y minerales |
| `add_recipe` | Crear receta con ingredientes |
| `get_weekly_report` | Informe semanal resumido |

## Ejemplo de uso en Claude

> "Comí una pizza de pepperoni, unas 800 calorías"
> → Claude llama `log_meal(name="Pizza pepperoni", calories=800)`

> "Cambia mi meta de calorías a 1800"
> → Claude llama `update_goals(calorie_goal=1800)`

> "¿Cómo voy hoy?"
> → Claude llama `get_daily_summary()` y te da un resumen

> "¿Cuándo llegaré a 70kg?"
> → Claude llama `predict_weight(weeks=24)`
