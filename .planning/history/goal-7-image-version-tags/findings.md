# Goal #7 Findings

## Registry field gap
- ConfigurationEdit already has registry field (`image` state, Input with agent default placeholder)
- ServerForm is MISSING the registry field — only sends `imageTag`, not `image`
- CreateServerRequest type already has `image?: string` field — just need to wire it up

## Tag refetch on registry change
- ConfigurationEdit already does this: `queryKey: ['registryTags', server.agent_id, image || server.steam_zomboid_registry]`
- fetchRegistryTags accepts optional `registry` param
- ServerForm should do the same: when custom registry is entered, refetch tags

## Version display current state
- ServerInfoCard shows: imageVersion if available, else falls back to imageTag or "latest"
- No existing images have the OCI label yet — so all servers show imageTag fallback
- This is correct behavior until steam-zomboid images are rebuilt with ARG IMAGE_VERSION
