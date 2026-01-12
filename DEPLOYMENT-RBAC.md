# Deploying RBAC & Authentication System

This guide walks through deploying the Role-Based Access Control (RBAC) and authentication system for ZedOps.

## Overview

The RBAC system adds:
- ✅ Email/password authentication with JWT tokens
- ✅ User management (invite/delete users)
- ✅ Role-based access control (admin/user roles)
- ✅ Granular permissions (agent, server, global levels)
- ✅ Complete audit logging of all actions
- ✅ Audit log viewer with filtering

---

## Prerequisites

- Wrangler CLI installed (`npm install -g wrangler`)
- Access to your Cloudflare account
- D1 database already created (ZEDOPS_DB)

---

## Step 1: Run Database Migrations

Apply all RBAC-related database migrations:

```bash
cd /Volumes/Data/docker_composes/zedops/manager

# Run migration 0006 (RBAC tables)
wrangler d1 execute ZEDOPS_DB --file=migrations/0006_create_rbac_tables.sql

# Run migration 0007 (default admin user)
wrangler d1 execute ZEDOPS_DB --file=migrations/0007_insert_default_admin.sql
```

### Verify Migrations

```bash
# Check that tables exist
wrangler d1 execute ZEDOPS_DB --command="SELECT name FROM sqlite_master WHERE type='table';"

# Should show: users, invitations, permissions, audit_logs

# Verify admin user exists
wrangler d1 execute ZEDOPS_DB --command="SELECT email, role FROM users;"
```

**Expected output:**
```
email: admin@zedops.local
role: admin
```

---

## Step 2: Build Frontend

Build the updated React frontend with authentication components:

```bash
cd /Volumes/Data/docker_composes/zedops/frontend

# Install dependencies (if needed)
npm install

# Build production bundle
npm run build

# Output will be in: frontend/dist/
```

---

## Step 3: Deploy Manager (Backend)

Deploy the updated manager with RBAC endpoints:

```bash
cd /Volumes/Data/docker_composes/zedops/manager

# Deploy to Cloudflare Workers
npm run deploy

# Or if using wrangler directly:
wrangler deploy
```

The manager now includes:
- `/api/auth/*` - Authentication endpoints
- `/api/users/*` - User management endpoints
- `/api/permissions/*` - Permission management
- `/api/audit` - Audit log viewer

---

## Step 4: Deploy Frontend Assets

Upload the built frontend to your hosting (Cloudflare Pages, R2, etc.):

### Option A: Cloudflare Pages

```bash
cd /Volumes/Data/docker_composes/zedops/frontend

# Deploy to Pages
wrangler pages deploy dist --project-name=zedops-frontend
```

### Option B: Manual Upload to R2/Static Hosting

Upload the contents of `frontend/dist/` to your static hosting.

---

## Step 5: First Login

1. **Navigate to your ZedOps frontend URL**
   - Example: `https://zedops.yourdomain.com`

2. **Login with default credentials:**
   ```
   Email: admin@zedops.local
   Password: admin123
   ```

3. **⚠️ IMMEDIATELY change the admin password:**
   - Currently, you'll need to create a new admin user and delete the default one
   - OR manually update the password in the database

---

## Step 6: Create Additional Users

Once logged in as admin:

1. Click **"Manage Users"** button
2. Click **"+ Invite User"**
3. Enter email and select role (admin or user)
4. Click **"Send Invitation"**
5. Copy the invitation link and send to the user
6. User visits the link and sets their password

---

## Step 7: Verify System

### Test Authentication
- ✅ Login works with admin credentials
- ✅ Logout works (clears session)
- ✅ Invalid credentials show error
- ✅ Expired tokens redirect to login

### Test User Management
- ✅ Can invite new users
- ✅ Can delete users (except yourself)
- ✅ Can manage user permissions
- ✅ Can grant/revoke permissions

### Test Audit Logs
- ✅ Click "Audit Logs" button
- ✅ See all logged actions
- ✅ Filter by user, action, target type
- ✅ Pagination works

---

## Security Checklist

- [ ] Change default admin password immediately
- [ ] Use strong passwords (8+ chars, mixed case, numbers, symbols)
- [ ] Review and remove the default admin user after creating a personal admin account
- [ ] Enable HTTPS on your frontend (should already be enabled with Cloudflare)
- [ ] Review audit logs regularly
- [ ] Only grant necessary permissions to users

---

## Troubleshooting

### "Invalid credentials" on login

**Check:**
```bash
# Verify user exists
wrangler d1 execute ZEDOPS_DB --command="SELECT email, role FROM users WHERE email='admin@zedops.local';"

# Check password hash exists
wrangler d1 execute ZEDOPS_DB --command="SELECT email, password_hash FROM users WHERE email='admin@zedops.local';"
```

### "Failed to fetch users" error

**Check:**
- Manager is deployed: `curl https://your-manager-url.workers.dev/api/users` (should return 401 without auth)
- JWT token is being sent in Authorization header (check browser DevTools → Network tab)

### Tables don't exist

**Re-run migrations:**
```bash
cd manager
wrangler d1 execute ZEDOPS_DB --file=migrations/0006_create_rbac_tables.sql
```

### Frontend shows old UI (no login page)

**Clear cache and rebuild:**
```bash
cd frontend
rm -rf dist/
npm run build
# Re-deploy the dist/ folder
```

---

## Rollback Plan

If something goes wrong and you need to rollback:

### Option 1: Keep users but disable auth temporarily
Add a temporary bypass in the middleware (not recommended for production)

### Option 2: Drop RBAC tables and redeploy old code
```bash
# WARNING: This deletes all users, permissions, and audit logs!
wrangler d1 execute ZEDOPS_DB --command="DROP TABLE IF EXISTS users;"
wrangler d1 execute ZEDOPS_DB --command="DROP TABLE IF EXISTS invitations;"
wrangler d1 execute ZEDOPS_DB --command="DROP TABLE IF EXISTS permissions;"
wrangler d1 execute ZEDOPS_DB --command="DROP TABLE IF EXISTS audit_logs;"

# Redeploy old manager code (from git)
```

---

## Next Steps

Once deployed and tested:

1. **Create your personal admin account**
2. **Delete the default admin user**
3. **Invite team members**
4. **Set up permissions** for non-admin users
5. **Review audit logs** regularly

---

## Default Credentials

**⚠️ Change these immediately after first login!**

```
Email: admin@zedops.local
Password: admin123
```

---

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review audit logs for error details
3. Check Cloudflare Workers logs: `wrangler tail`
4. Check browser console for frontend errors
