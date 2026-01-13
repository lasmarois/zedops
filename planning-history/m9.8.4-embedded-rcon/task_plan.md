# M9.8.4 Task Plan - Embed RCON Terminal in Tab

**Milestone:** M9.8.4 - Embed RCON Terminal Instead of Full-Screen Overlay
**Parent:** M9.8 - Polish & Production Readiness
**Priority:** MEDIUM (UX Improvement)
**Estimated Duration:** 30 minutes
**Started:** 2026-01-13

---

## Goal

Embed the RCON terminal directly in the ServerDetail RCON tab instead of showing it as a full-screen overlay, allowing users to use RCON while still seeing server details.

---

## Success Criteria

- [ ] Plan created
- [ ] Add `embedded` prop to RconTerminal component
- [ ] Conditional styling: embedded vs overlay mode
- [ ] Update ServerDetail to use embedded mode
- [ ] X button behavior decided (hide or minimize)
- [ ] Build succeeds
- [ ] Deployed to production
- [ ] User validates embedded RCON works

---

## Current State Analysis

**Location:** `frontend/src/components/RconTerminal.tsx`

**Current Implementation:**
- Always renders as **fixed full-screen overlay** (line 469):
  ```tsx
  <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80">
  ```
- Takes up entire viewport with backdrop
- Blocks all other UI

**Two Use Cases:**
1. **AgentServerList:** Overlay makes sense (viewing a list, RCON is temporary)
2. **ServerDetail:** Embed makes sense (viewing one server, RCON is primary feature)

---

## Implementation Phases

### Phase 1: Add Embedded Prop to RconTerminal (15 min) - `pending`

**Goal:** Make RconTerminal support both overlay and embedded modes

**Changes to RconTerminal.tsx:**

1. **Add `embedded` prop to interface (line 23):**
   ```tsx
   interface RconTerminalProps {
     agentId: string;
     serverId: string;
     serverName: string;
     containerID: string;
     rconPort: number;
     rconPassword: string;
     onClose: () => void;
     embedded?: boolean;  // NEW: default false (overlay mode)
   }
   ```

2. **Extract prop (line 33):**
   ```tsx
   export function RconTerminal({
     agentId,
     serverId,
     serverName,
     containerID,
     rconPort,
     rconPassword,
     onClose,
     embedded = false,  // NEW
   }: RconTerminalProps) {
   ```

3. **Conditional wrapper styling (line 468):**
   ```tsx
   return embedded ? (
     // Embedded mode: normal div, fits in parent container
     <div className="bg-[#1e1e1e] rounded-lg w-full h-[600px] flex flex-col shadow-lg">
       {/* Same content */}
     </div>
   ) : (
     // Overlay mode: fixed full-screen (existing behavior)
     <div className="fixed inset-0 z-[1000] flex items-center justify-center p-8 bg-black/80">
       <div className="bg-[#1e1e1e] rounded-lg w-full max-w-[1200px] h-[80vh] flex flex-col shadow-2xl">
         {/* Same content */}
       </div>
     </div>
   );
   ```

4. **Conditional X button (line 481):**
   ```tsx
   {!embedded && (  // Only show X in overlay mode
     <Button
       variant="ghost"
       size="sm"
       onClick={onClose}
       className="text-2xl hover:text-destructive"
     >
       ✕
     </Button>
   )}
   ```

**Files to Modify:**
- `frontend/src/components/RconTerminal.tsx`

---

### Phase 2: Update ServerDetail to Use Embedded Mode (5 min) - `pending`

**Goal:** Render RCON terminal directly in tab, no button needed

**Changes to ServerDetail.tsx:**

1. **Remove showRcon state (line 19):**
   ```tsx
   // DELETE: const [showRcon, setShowRcon] = useState(false)
   ```

2. **Update RCON tab content (lines 333-352):**
   ```tsx
   <TabsContent value="rcon" className="space-y-6">
     {agentId && containerID ? (
       <RconTerminal
         agentId={agentId}
         serverId={serverId}
         serverName={serverName}
         containerID={containerID}
         rconPort={rconPort}
         rconPassword={rconPassword}
         onClose={() => {}}  // Not used in embedded mode
         embedded={true}     // NEW: embedded mode
       />
     ) : (
       <Card>
         <CardContent className="py-12 text-center">
           <p className="text-muted-foreground">
             Server must be running to use RCON
           </p>
         </CardContent>
       </Card>
     )}
   </TabsContent>
   ```

3. **Remove conditional RconTerminal after tabs (lines 389-400):**
   ```tsx
   // DELETE: {showRcon && agentId && containerID && (
   //   <RconTerminal ... />
   // )}
   ```

**Files to Modify:**
- `frontend/src/pages/ServerDetail.tsx`

---

### Phase 3: Verify AgentServerList Still Works (2 min) - `pending`

**Goal:** Ensure overlay mode still works in AgentServerList

**Check AgentServerList.tsx (line 1053):**
```tsx
<RconTerminal
  agentId={agentId}
  serverId={rconServer.id}
  serverName={rconServer.name}
  containerID={rconServer.container_id || ''}
  rconPort={rconServer.rcon_port}
  rconPassword={rconPassword}
  onClose={() => setRconServer(null)}
  // embedded prop not passed = defaults to false = overlay mode ✓
/>
```

**Expected:** No changes needed, overlay mode is default.

---

### Phase 4: Build & Deploy (5 min) - `pending`

**Steps:**
1. Build frontend: `cd frontend && npm run build`
2. Deploy backend: `cd manager && npx wrangler deploy`
3. Verify deployment URL: https://zedops.mail-bcf.workers.dev
4. Test both use cases:
   - ServerDetail RCON tab: embedded
   - AgentServerList RCON: overlay

**Expected Results:**
- ServerDetail: RCON embedded in tab, no X button, always visible when tab active
- AgentServerList: RCON as overlay with X button, closes properly

---

## Design Decisions

### X Button Behavior

**Decision:** Hide X button in embedded mode
- Embedded terminal is part of the tab content
- User closes it by switching tabs
- No need for redundant close button
- Cleaner UI

### Height

**Decision:** Fixed 600px height for embedded mode
- Fits well in tab without excessive scrolling
- Matches typical terminal height
- Can be adjusted based on user feedback

### Width

**Decision:** Full width in embedded mode
- Uses available tab space
- Consistent with other tab content
- Terminal benefits from horizontal space

---

## Errors Encountered

None yet.

---

## Notes

- This is M9.8.4 (fourth sub-milestone of M9.8 polish phase)
- User requested: "yes embed it"
- Embedded mode better UX for ServerDetail (can see server info + use RCON)
- Overlay mode still makes sense for AgentServerList (temporary action)
- Backward compatible: `embedded` prop defaults to false
