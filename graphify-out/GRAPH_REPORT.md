# Graph Report - pwa-app  (2026-06-09)

## Corpus Check
- 13 files · ~40,400 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 132 nodes · 136 edges · 12 communities (8 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `05dad7fc`
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

## God Nodes (most connected - your core abstractions)
1. `LifeTrack MCP Server` - 9 edges
2. `mergeSync()` - 5 edges
3. `fmtDate()` - 4 edges
4. `mergeClientServer()` - 4 edges
5. `_localDateStr()` - 3 edges
6. `ensureDir()` - 3 edges
7. `scripts` - 3 edges
8. `today()` - 2 edges
9. `sanitizeUntrusted()` - 2 edges
10. `unionEntries()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (12 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (34): ACTIVITIES, App, Benchmark, BENCHMARK_LMS, Charts, CloudSync, CUTTING_STYLES, DarkMode (+26 more)

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
Cohesion: 0.40
Nodes (5): calcStreaks(), fmtDate(), generateWeeklyInsights(), _localDateStr(), today()

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (4): mergeClientServer(), sanitizeUntrusted(), unionDayLog(), unionEntries()

## Knowledge Gaps
- **80 isolated node(s):** `DAYS_SHORT`, `DAYS_FULL`, `MONTHS`, `MICROS`, `MICRO_KEYS` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `DAYS_SHORT`, `DAYS_FULL`, `MONTHS` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._