# Findings: M9.8.46 - Restore Managed Badge

## Code Analysis

### ServerCard Component Structure

The component has two layouts controlled by the `layout` prop:
- `"expandable"` - Click to expand, shows details inline
- `"compact"` - Dense single-row with hover tooltip

### Expandable Layout (lines 364-429)
```
[Status] [Name] [Managed Badge] | [Actions] [Dropdown] [Expand]
         [Info: agent • tag • size • uptime • players]
```
- Badge is present ✅
- Badge is inside the name row, after the server name

### Compact Layout (lines 431-471)
```
[Status] [Name] [Info: agent • tag • size • uptime • players] | [Actions] [Dropdown]
```
- Badge is MISSING ❌
- Info text is truncated on small screens (`hidden sm:inline`)

### Badge Variants
1. **Managed**: `bg-primary/10 text-primary border-primary/20`
2. **Unmanaged**: `variant="outline" border-2 text-muted-foreground`

### Responsive Considerations
- Compact layout is denser, less space
- Badge should remain visible even on small screens
- May need to hide on very small screens if space is tight

## Fix Strategy

Add badge between name and info text in compact layout. Keep same styling as expandable layout.
