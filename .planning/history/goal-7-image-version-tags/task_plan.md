# Goal #7: Show Image Version & Dynamic Tag Selection

## Phase 1: Docker Image (steam-zomboid repo) — SKIPPED
Not part of zedops repo. OCI version label to be added separately.

## Phase 2: Agent — extract version + list registry tags
- [x] Add `ImageVersion` field to `ContainerInfo` struct
- [x] Extract version from container labels in `ListContainers()`
- [x] Add `go-containerregistry/crane` dependency
- [x] Add `ListRegistryTags()` function
- [x] Add `registry.tags` message handler in `main.go`

## Phase 3: Manager — pass through version + new tags endpoint
- [x] Pass `image_version` from container data in `GET /api/servers`
- [x] Pass `image_version` in `GET /api/servers/:id`
- [x] Add `/registry/tags` DO endpoint in `AgentConnection.ts`
- [x] Add `GET /api/agents/:id/registry-tags` in `agents.ts`

## Phase 4: Frontend — display version + dynamic tag dropdown
- [x] Add `image_version` to `Server` interface in `api.ts`
- [x] Add `fetchRegistryTags()` API function
- [x] Update `ServerInfoCard` to display resolved version
- [x] Update `ServerCard` to display resolved version
- [x] Update `ServerOverview` to pass `imageVersion` prop
- [x] Update `ServerForm` with dynamic tag dropdown
- [x] Update `ConfigurationEdit` with dynamic tag dropdown
