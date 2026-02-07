# M9.8.44 - Research Findings

## Current Overview Page Analysis

### What's Being Removed
- **Log Preview** (lines ~479-548 in ServerDetail.tsx)
  - Shows last 5 logs with pause/auto-scroll/clear buttons
  - "Expand View" button navigates to Logs tab
  - Redundant - users can go directly to Logs tab

- **RCON Preview** (lines ~551-610 in ServerDetail.tsx)
  - Shows last 3 RCON commands with responses
  - "Expand View" button navigates to RCON tab
  - Redundant - users can go directly to RCON tab

### What Stays
- Header (server name, status badge, player count, uptime)
- Action buttons (Start/Stop/Restart/Rebuild/Delete)
- Metrics cards (Uptime, CPU, Memory, Disk I/O, Players)
- Quick Actions section (needs enhancement)

## New Components Needed

### Server Info Card
Data available from server API:
- `image_tag` - Game version/image
- `config` - Contains map name, mods, settings
- `server_data_path` - Data location

### Connection Card
Data needed:
- Server IP (from agent or config)
- Game port (from config)
- Steam connect link format

### Health Indicators
- RCON status: Can ping via existing RCON infrastructure
- Container health: Already have `health` field
- Disk space: Need to add to metrics

### Recent Events
- Reuse existing audit log / activity feed component
- Filter by server_id
- Show: player joins/leaves, restarts, config changes

## Sparklines Decision

**Decision:** Placeholder for this milestone, full implementation deferred.

**Future Implementation:**
- Store metrics history in D1 database
- 3-day retention period
- Metrics to track: CPU, Memory, Players (per-server)
- Sparklines for: CPU, Memory, Players cards
- Uptime and Disk I/O don't need sparklines (cumulative/static)

**Noted in:** MILESTONES.md → Future Milestones section

---

## Layout Considerations

### Grid Layout
```
[Metrics Row - 5 cards]
[Info + Connection] [Events]
[Quick Actions    ] [Health]
```

### Stacked Layout
```
[Metrics Row - 5 cards]
[Server Info] [Connection]
[Quick Actions]
[Recent Events]
[Health Indicators]
```

### Masonry Layout
- CSS columns or grid with auto-placement
- Cards size themselves based on content

### Sidebar Layout
```
[Sidebar      ] [Main Content        ]
[Info         ] [Metrics Row         ]
[Connection   ] [Events              ]
[Health       ] [Quick Actions       ]
```
