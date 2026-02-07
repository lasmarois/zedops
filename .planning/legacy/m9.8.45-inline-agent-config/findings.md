# Findings: M9.8.45 - Inline Agent Configuration

## Current Implementation Analysis

### AgentDetail.tsx Structure
- Lines 31, 121, 272, 349: configModalOpen state and modal trigger
- Lines 35-39: useQuery for agentConfig (enabled when modal open OR config tab active)
- Lines 42-49: updateConfigMutation for saving
- Lines 81-83: handleSaveConfig passes to mutation
- Lines 117-134: Header with "Configure" and "Disconnect" buttons
- Lines 264-336: Configuration tab content (read-only view)

### AgentConfigModal.tsx Features to Port
1. Form state management (lines 32-37)
2. useEffect to initialize form on open (lines 40-48)
3. Validation logic in handleSave (lines 50-108):
   - server_data_path required
   - Must be absolute path (starts with /)
   - Cannot be root (/)
   - Only sends changed fields
4. Error/success alerts (lines 178-190)
5. Loading state during save (lines 94, 105-107)

### AgentConfig Interface
```typescript
interface AgentConfig {
  server_data_path: string;
  steam_zomboid_registry: string;
  hostname: string | null;
}
```

### Required UI Components (already imported in AgentDetail)
- Input (need to add import)
- Button ✓
- Label ✓
- Alert, AlertDescription ✓
- Loader2 (need to add import)

### Query Behavior Note
Currently queries agentConfig when:
```typescript
enabled: !!id && (configModalOpen || activeTab === 'config')
```
After removing modal, simplify to:
```typescript
enabled: !!id && activeTab === 'config'
```

## UX Considerations

### Edit Mode Toggle
- "Edit" button in card header when viewing
- "Save" and "Cancel" buttons when editing
- Disable "Edit" button if agent offline

### Form Reset on Cancel
- Reset all form fields to original values from agentConfig
- Clear error/success states
- Exit edit mode

### Success Feedback
- Show success alert briefly
- Auto-close edit mode after save
- Could show inline success or toast
