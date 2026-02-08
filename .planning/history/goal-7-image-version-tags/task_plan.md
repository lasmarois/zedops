# Goal #7: Show Image Version & Dynamic Tag Selection — COMPLETE

## Phase 2-4: Core implementation
- [x] Agent: ImageVersion extraction from OCI labels + ListRegistryTags via crane
- [x] Manager: image_version passthrough in server APIs + registry-tags endpoint
- [x] Frontend: dynamic tag dropdown in ServerForm + ConfigurationEdit
- [x] Frontend: version display in ServerInfoCard + ServerCard
- [x] Filter buildcache tags from registry list

## Phase 5: Version display verification
- [x] Server overview shows "latest" fallback correctly (no OCI label on current images)
- [x] ServerCard shows "latest" in metadata line
- [x] Note: resolved version will appear after steam-zomboid images rebuilt with OCI label

## Phase 6: Registry field in Create Server form
- [x] Add `image` (registry) state to ServerForm
- [x] Add registry input with agent default as placeholder
- [x] Pass `image` in CreateServerRequest when set
- [x] Wire dynamic tag dropdown to re-fetch when custom registry is entered
