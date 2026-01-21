# M10.2 - Systemd Service Installation - Findings

## Install Script Issues (Fixed)

### 1. Variable Expansion in Heredoc
Changed from `<< 'EOF'` to `<< EOF` so variables expand at install time.

### 2. SELinux Context
Binary downloaded to /tmp has wrong context. Fixed with `restorecon`.

### 3. Systemd Restart Policy
Changed from `Restart=always` to `Restart=on-failure` with `RestartPreventExitStatus=78`.

## Agent Request Frequency Analysis

### Per Healthy Agent (authenticated)
| Operation | Interval | Requests/hour |
|-----------|----------|---------------|
| Heartbeat | 30s | 120 |
| Metrics batch | 10s | 360 |
| Player stats | 10s | 360 |
| **Total** | | **~840/hour** |

### Per Failing Agent (before fix)
| Operation | Interval | Requests/hour |
|-----------|----------|---------------|
| Auth retry | 1s | **3,600** |

**Impact:** One failing agent generates 4x more requests than a healthy one!

## Auth Failure Behavior (After Fix)

```
========================================
AUTHENTICATION FAILED - AGENT STOPPING
========================================
Error: authentication failed: Agent not found

Possible causes:
  - Agent was deleted from the manager
  - Token is invalid or expired
  - Agent name mismatch

To fix:
  1. Generate a new token in the manager UI
  2. Re-run the install script with --token flag
  3. Restart the agent: sudo systemctl start zedops-agent
========================================
Exiting with code 78 (auth failure - systemd will not restart)
```

## Exit Codes

| Code | Meaning | Systemd Action |
|------|---------|----------------|
| 0 | Normal exit | No restart |
| 1 | General error | Restart |
| 78 | Auth failure (EX_CONFIG) | **No restart** (RestartPreventExitStatus) |

## Directory Structure
```
/usr/local/bin/zedops-agent              # Binary
/etc/zedops-agent/config                 # Configuration
/root/.zedops-agent/token                # Auth token
/etc/systemd/system/zedops-agent.service # Service file
```
