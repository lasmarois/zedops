# Goal #21: Progress

## Session 1 — 2026-02-09 (Investigation & Planning)

### What happened
- User reported mods not showing in config tab for `steam-zomboid-newyear` on prod
- Investigated the full config tab data flow (ENV vars in D1 → API → frontend)
- Discovered mods are configured in PZ server `.ini` files, NOT via ENV vars
- Config tab only reads ENV-based `SERVER_MODS`/`SERVER_WORKSHOP_ITEMS` from D1
- Found mods in INI files at old paths:
  - `build42-jan26`: 3 mods, 3 workshop items
  - `newyear`: 8 mods, 7 workshop items
- **Critical finding**: Adopted containers have EMPTY data dirs — adoption created new dirs instead of reusing original mounts (likely `HostConfig.Binds` vs `HostConfig.Mounts` issue)
- Created implementation plan for INI reading feature
- **Iced** goal to prioritize fixing the adoption mount preservation bug first (Goal #22)

### Decisions
- INI reading approach: agent reads file → DO route → API endpoint → frontend display
- Extend existing `GET /api/servers/:id` response rather than new endpoint
- Fix adoption bug first since it causes data loss (higher priority)

### Also fixed this session (unrelated)
- `fix: exclude rcon_port from port conflict checks` — RCON is internal-only, was blocking adoption of newyear due to shared port 27015 with build42-jan26
