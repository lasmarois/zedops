# Task: M9.8.45 - Inline Agent Configuration (Remove Modal)

## Goal
Remove the agent configuration modal and make the Configuration tab directly editable inline. This provides a better UX by eliminating the extra click to open a modal.

## Current State
- AgentDetail.tsx has:
  - "Configure" button in header (opens modal)
  - "Edit Configuration" button in Configuration tab (opens modal)
  - AgentConfigModal component for editing
- Configuration tab shows read-only view of settings
- Modal contains: server_data_path, steam_zomboid_registry, hostname fields

## Target State
- No "Configure" button in header
- Configuration tab has inline editable form
- Edit mode toggle (view/edit states)
- Save/Cancel buttons when editing
- AgentConfigModal removed

## Phases

### Phase 1: Create Inline Edit Form in Configuration Tab
**Status:** `complete`
- [x] Add edit mode state (`isEditing`)
- [x] Create form state for all fields
- [x] Replace read-only divs with Input components when editing
- [x] Show view mode (current behavior) when not editing

### Phase 2: Add Edit Controls
**Status:** `complete`
- [x] Add "Edit" button to Configuration card header (when not editing)
- [x] Add "Save" and "Cancel" buttons (when editing)
- [x] Implement cancel to reset form state
- [x] Move validation logic from modal to inline form

### Phase 3: Handle Save Logic
**Status:** `complete`
- [x] Port handleSave validation from AgentConfigModal
- [x] Show error/success alerts inline
- [x] Reset edit mode on successful save
- [x] Handle loading states (isSaving)

### Phase 4: Remove Modal & Configure Button
**Status:** `complete`
- [x] Remove "Configure" button from header
- [x] Remove AgentConfigModal import
- [x] Remove AgentConfigModal component usage
- [x] Remove configModalOpen state
- [x] Clean up unused imports

### Phase 5: Build, Deploy & Test
**Status:** `complete`
- [x] Build frontend
- [x] Update asset hash in index.ts
- [x] Deploy to Cloudflare
- [ ] Test: Edit config inline, save, verify persisted

## Files to Modify
- `frontend/src/pages/AgentDetail.tsx` - Main changes (inline editing)
- `frontend/src/components/AgentConfigModal.tsx` - Delete file

## Key Implementation Notes

### Form State Management
```typescript
const [isEditing, setIsEditing] = useState(false)
const [serverDataPath, setServerDataPath] = useState('')
const [steamZomboidRegistry, setSteamZomboidRegistry] = useState('')
const [hostname, setHostname] = useState('')
const [error, setError] = useState<string | null>(null)
const [success, setSuccess] = useState(false)
```

### Initialize Form on Edit
When entering edit mode, populate form state from agentConfig:
```typescript
const handleStartEdit = () => {
  if (agentConfig) {
    setServerDataPath(agentConfig.server_data_path || '')
    setSteamZomboidRegistry(agentConfig.steam_zomboid_registry || '')
    setHostname(agentConfig.hostname || '')
    setError(null)
    setSuccess(false)
  }
  setIsEditing(true)
}
```

### Validation (from AgentConfigModal)
- server_data_path: required, must start with `/`, cannot be `/`
- steam_zomboid_registry: optional
- hostname: optional, trim whitespace, send null if empty

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
