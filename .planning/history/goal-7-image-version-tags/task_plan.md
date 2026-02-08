# Goal #7: Show Image Version & Dynamic Tag Selection

## Phase 1: OCI label in steam-zomboid Docker image — COMPLETE
- [x] Add `ARG IMAGE_VERSION=latest` to Dockerfile
- [x] Add `LABEL org.opencontainers.image.version="${IMAGE_VERSION}"` to Dockerfile
- [x] Create `.gitlab-ci.yml` — builds image on tag/master push, passes tag as IMAGE_VERSION
- [x] Push to steam-zomboid repo and verify CI builds
- [x] Tag v2.1.5 — CI pipeline passed, image published with OCI version label
- [x] Verified end-to-end: created server on dev, version shows "2.1.5" in Server Info

## Phase 2-4: Core implementation (COMPLETE)
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
