# Graph Report - pwa-app  (2026-07-22)

## Corpus Check
- 17 files · ~41,813 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 137 nodes · 137 edges · 14 communities (9 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3637c4b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `LifeTrack MCP Server` - 9 edges
2. `mergeSync()` - 5 edges
3. `fmtDate()` - 4 edges
4. `mergeClientServer()` - 4 edges
5. `ensureDir()` - 3 edges
6. `scripts` - 3 edges
7. `_localDateStr()` - 3 edges
8. `getData()` - 2 edges
9. `saveData()` - 2 edges
10. `sanitize()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `calcStreaks()` --calls--> `fmtDate()`  [INFERRED]
  shared/insights.js → shared/constants.js
- `generateWeeklyInsights()` --calls--> `fmtDate()`  [INFERRED]
  shared/insights.js → shared/constants.js

## Import Cycles
- None detected.

## Communities (14 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (8): App, Charts, DarkMode, Fasting, FoodAPI, Hydration, MealReminder, Notif

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (15): dependencies, cors, express, @modelcontextprotocol/sdk, zod, description, engines, node (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (13): background_color, categories, description, display, icons, lang, name, orientation (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (12): DATA_DIR, DATA_FILE, DEFAULTS, __dir, ensureDir(), FORBIDDEN_KEYS, getData(), mergeSync() (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (9): Configurar Claude Code, Configurar Claude Desktop, Configurar la PWA Android, Ejemplo de uso en Claude, Herramientas MCP disponibles, Iniciar servidor, Instalación, LifeTrack MCP Server (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (4): ALLOWED_ORIGINS, app, mcp, transport

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (18): ACTIVITIES, CUTTING_STYLES, DAYS_FULL, DAYS_SHORT, INGREDIENT_MICROS, INGREDIENTS, _localDateStr(), MEAL_SLOTS (+10 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (8): fmtDate(), Benchmark, BENCHMARK_LMS, calcStreaks(), generateWeeklyInsights(), LIFT_STANDARDS, LIFT_TIERS, Strength

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (8): CloudSync, _FORBIDDEN_KEYS, MCPSync, mergeClientServer(), _NUMERIC_KEYS, sanitizeUntrusted(), unionDayLog(), unionEntries()

## Knowledge Gaps
- **80 isolated node(s):** `Notif`, `Hydration`, `MealReminder`, `DarkMode`, `Fasting` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fmtDate()` connect `Community 7` to `Community 6`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `fmtDate()` (e.g. with `calcStreaks()` and `generateWeeklyInsights()`) actually correct?**
  _`fmtDate()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Notif`, `Hydration`, `MealReminder` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._