# RBAC System - Quick Start

**⏱️ Deployment time: ~10 minutes**

## TL;DR

```bash
cd /Volumes/Data/docker_composes/zedops

# 1. Run migrations (2 minutes)
cd manager
wrangler d1 execute ZEDOPS_DB --file=migrations/0006_create_rbac_tables.sql
wrangler d1 execute ZEDOPS_DB --file=migrations/0007_insert_default_admin.sql

# 2. Deploy backend (2 minutes)
npm run deploy

# 3. Build & deploy frontend (3 minutes)
cd ../frontend
npm run build
wrangler pages deploy dist --project-name=zedops-frontend

# 4. Verify (1 minute)
cd ..
./verify-rbac.sh

# 5. Login
# Email: admin@zedops.local
# Password: admin123
# ⚠️ CHANGE PASSWORD IMMEDIATELY!
```

---

## What You Get

After deployment:
- ✅ Login page with email/password auth
- ✅ JWT-based authentication (secure, stateless)
- ✅ User management UI (invite, delete, manage permissions)
- ✅ Role-based access (admin/user roles)
- ✅ Granular permissions (per-agent, per-server, global)
- ✅ Complete audit trail (who did what, when)
- ✅ Audit log viewer with filters

---

## Default Credentials

```
Email: admin@zedops.local
Password: admin123
```

**⚠️ CHANGE THESE IMMEDIATELY AFTER FIRST LOGIN!**

---

## Post-Deployment Checklist

- [ ] Login with default credentials works
- [ ] Create your personal admin account
- [ ] Delete default admin user
- [ ] Invite team members
- [ ] Set up permissions for non-admin users
- [ ] Test audit log viewer
- [ ] Bookmark your ZedOps URL

---

## Quick Tests

### Test 1: Login works
```bash
curl -X POST https://your-manager-url.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zedops.local","password":"admin123"}'

# Should return: {"success":true,"token":"...","user":{...}}
```

### Test 2: Auth is enforced
```bash
curl https://your-manager-url.workers.dev/api/users

# Should return: {"error":"Unauthorized"} (401)
```

### Test 3: Authenticated request works
```bash
TOKEN="your-jwt-token-from-test-1"
curl https://your-manager-url.workers.dev/api/users \
  -H "Authorization: Bearer $TOKEN"

# Should return: {"users":[{...}]}
```

---

## Common Issues

### "User not found" on login
→ Run migration 0007: `wrangler d1 execute ZEDOPS_DB --file=migrations/0007_insert_default_admin.sql`

### "Table doesn't exist" error
→ Run migration 0006: `wrangler d1 execute ZEDOPS_DB --file=migrations/0006_create_rbac_tables.sql`

### Frontend shows old UI (no login page)
→ Clear browser cache or open in incognito mode

### "Invalid credentials" with correct password
→ Password hash mismatch. Re-run migration 0007.

---

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │  React app with login UI
│   (Pages/R2)    │  → Uses JWT tokens
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   Manager       │  Cloudflare Worker
│   (Worker)      │  → Validates JWT tokens
│                 │  → Enforces permissions
│                 │  → Logs all actions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database      │  D1 (SQLite)
│   (D1)          │  → users, permissions,
│                 │     invitations, audit_logs
└─────────────────┘
```

---

## User Roles

| Role  | Capabilities |
|-------|-------------|
| Admin | Everything (manage users, permissions, view audit logs) |
| User  | View/control agents/servers (based on granted permissions) |

---

## Permission Levels

| Level        | Description |
|--------------|-------------|
| view         | Read-only access |
| control      | Start/stop/restart |
| delete       | Delete resources |
| manage_users | Invite/manage users (global only) |

---

## Need Help?

See the full deployment guide: `DEPLOYMENT-RBAC.md`

Or run the verification script:
```bash
./verify-rbac.sh
```
