# Goal #9 Findings

## DO Route Audit (2026-02-07)

### Broken routes found
| Caller | Bad URL | Parsed pathname | DO expects | Fix |
|--------|---------|-----------------|------------|-----|
| check-data endpoint | `http://internal/check-data` | `/check-data` | `/internal/check-data` | Changed DO handler to `/check-data` |
| apply-config recovery | `http://do/servers/checkdata` | `/servers/checkdata` | (none) | Use `/check-data` with single-server format |
| apply-config recovery | `http://do/servers/${id}/create` | `/servers/${id}/create` | (none) | Use `POST /servers` |

### Why this pattern breaks
Cloudflare DO `fetch()` URLs use `http://hostname/path`. The hostname is arbitrary (ignored by DO).
- `http://do/servers/sync` → pathname `/servers/sync` — matches handler
- `http://internal/check-data` → pathname `/check-data` — handler was checking `/internal/check-data` (wrong)
- `http://do/servers/${id}/create` → no handler for this pattern at all

### All working DO routes (verified)
`/ws`, `/logs/ws`, `/status`, `/containers`, `/registry/tags`, `/players`, `/ports/check`,
`/notify-update`, `/servers` (POST), `/servers/sync`, `/check-data`, `/servers/:id` (DELETE),
`/servers/:id/rebuild`, `/servers/:id/move`, `/servers/:id/datapath`, `/servers/:id/storage`,
`/servers/:id/backup`, `/servers/:id/backups/sync`, `/servers/:id/backups/:name` (DELETE),
`/servers/:id/backups/:name/restore`
