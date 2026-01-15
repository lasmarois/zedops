# Task Plan: Configuration Tab Display (M9.8.22)

**Goal:** Display agent configuration in Configuration tab with read-only view and edit button

**Priority:** HIGH (Quick UX improvement)
**Started:** 2026-01-14
**References:** M9.8.21 (Agent Configuration - Configure Button)

---

## User Requirements

1. **Configuration tab** should show actual configuration (not placeholder)
2. **Read-only display** of current settings
3. **Edit Configuration button** opens the existing modal
4. **Clean card layout** matching ZedOps design patterns
5. **Easy to scan** - users can see config without clicking

---

## Current State

From M9.8.21, we have:
- ✅ AgentConfigModal component working
- ✅ Configure button in header opens modal
- ✅ API endpoints for fetching/updating config
- ❌ Configuration tab shows placeholder: "Agent configuration settings will be available in a future update."

**Location:** `frontend/src/pages/AgentDetail.tsx:266-276`

---

## What Needs to Be Built

### Configuration Tab Content

**Layout Design:**
```
┌────────────────────────────────────────────────┐
│ Configuration                                  │
├────────────────────────────────────────────────┤
│                                                │
│ ┌──────────────────────────────────────────┐  │
│ │ Server Settings                          │  │
│ │                                          │  │
│ │ Server Data Path                         │  │
│ │ /var/lib/zedops/servers                  │  │
│ │                                          │  │
│ │ Docker Registry                          │  │
│ │ registry.gitlab.nicomarois.com/...       │  │
│ │                                          │  │
│ │ [Edit Configuration]                     │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ ℹ️ These settings are inherited by new        │
│    servers created on this agent.             │
│                                                │
└────────────────────────────────────────────────┘
```

**Features:**
- Display current config values (read-only)
- "Edit Configuration" button opens modal
- Info message about server inheritance
- Graceful loading state while fetching
- Error state if config fails to load

---

## Implementation Plan

### Step 1: Update Configuration Tab Content

**File:** `frontend/src/pages/AgentDetail.tsx`

**Current Code (lines 266-276):**
```typescript
<TabsContent value="config" className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Agent Configuration</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        Agent configuration settings will be available in a future update.
      </p>
    </CardContent>
  </Card>
</TabsContent>
```

**New Code:**
```typescript
<TabsContent value="config" className="space-y-6">
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle>Server Settings</CardTitle>
        <Button
          variant="outline"
          onClick={() => setConfigModalOpen(true)}
          disabled={agent.status !== 'online'}
        >
          Edit Configuration
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-6">
      {isLoadingConfig ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : agentConfig ? (
        <>
          {/* Server Data Path */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Server Data Path</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm">
              {agentConfig.server_data_path}
            </div>
            <p className="text-xs text-muted-foreground">
              Host directory where server data (bin, saves) will be stored.
            </p>
          </div>

          {/* Docker Registry */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Docker Registry</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
              {agentConfig.steam_zomboid_registry}
            </div>
            <p className="text-xs text-muted-foreground">
              Docker registry URL for the Steam Zomboid server image.
            </p>
          </div>

          {/* Info Banner */}
          <Alert>
            <AlertDescription>
              These settings are inherited by new servers created on this agent.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load agent configuration. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

### Step 2: Update Config Fetching Logic

**Current:** Config only fetches when modal opens (`enabled: !!id && configModalOpen`)

**Change to:** Fetch when tab is active OR modal is open

**Update useQuery:**
```typescript
const [activeTab, setActiveTab] = useState('overview')

const { data: agentConfig, isLoading: isLoadingConfig } = useQuery({
  queryKey: ['agentConfig', id],
  queryFn: () => fetchAgentConfig(id!),
  enabled: !!id && (configModalOpen || activeTab === 'config'),
})
```

**Update Tabs:**
```typescript
<Tabs defaultValue="overview" className="space-y-6" onValueChange={setActiveTab}>
```

### Step 3: Add Label Import

**Add to imports:**
```typescript
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
```

---

## Testing Checklist

- [ ] Configuration tab displays server_data_path
- [ ] Configuration tab displays steam_zomboid_registry
- [ ] "Edit Configuration" button opens modal
- [ ] Loading skeleton shows while fetching config
- [ ] Error alert shows if fetch fails
- [ ] Info banner explains setting inheritance
- [ ] Button disabled when agent offline
- [ ] Config fetches when switching to tab
- [ ] No duplicate fetches when switching between tab and modal

---

## Files to Modify

- `frontend/src/pages/AgentDetail.tsx` - Update Configuration tab content (~80 lines changed)

---

## Success Criteria

- [x] Configuration tab shows actual config values
- [x] Read-only display with clean layout
- [x] Edit button opens modal
- [x] Loading and error states handled
- [x] No placeholder text
- [x] Matches ZedOps design patterns

---

## Estimated Time

**15-30 minutes** (quick implementation)

---

## Notes

**Why This Improves UX:**
- Users can see config without clicking Configure button
- Configuration is discoverable (visible in dedicated tab)
- Edit button provides clear path to modify settings
- Consistent with common admin UI patterns

**Design Decisions:**
- Use `bg-muted` for read-only fields (distinguishes from editable inputs)
- Font-mono for paths/URLs (easier to read technical strings)
- Info Alert at bottom (explains behavior without cluttering)
- Edit button in header (clear call-to-action)

**Future Enhancements:**
- Add storage metrics card below settings (M9.8.24)
- Add more config sections as features are added
- Consider "Copy to Clipboard" buttons for paths/URLs
