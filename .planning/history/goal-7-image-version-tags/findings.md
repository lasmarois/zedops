# Goal #7 Findings

## Container Image Version
- OCI label: `org.opencontainers.image.version` — standard label for image version
- Container labels accessible via `c.Labels` in Docker SDK's `ContainerList`
- `ContainerInfo` already has `Labels map[string]string` field

## Registry Tags
- `go-containerregistry/crane` provides `crane.ListTags()` — reads Docker credentials automatically
- Alternative: raw HTTP v2 registry API (more complex, requires auth token dance)
- Choosing crane for simplicity

## Frontend Image Tag Dropdown
- ServerForm currently hardcodes: latest, 2.1.0, 2.1, 2.0.1, 2.0.0 (lines 289-295)
- ConfigurationEdit uses free-text `<Input>` for imageTag (lines 408-414)
- Both need dynamic dropdown with fetched tags
