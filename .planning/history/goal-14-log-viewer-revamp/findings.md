# Goal #14: Findings

## Existing Patterns

### RCON Terminal Theme (from RconTerminal.tsx)
```typescript
theme: {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
}
```

### Log Data Shapes
- Container logs: `{ containerId, timestamp (ms), stream ('stdout'|'stderr'), message }`
- Agent logs: `{ timestamp (ms), level ('INFO'|'WARN'|'ERROR'|'DEBUG'), message }`

### Components to keep from terminal-log.tsx
- `TerminalStatus` — used in both viewers
- `TerminalLineCount` — used in both viewers
- `LogLine` type — used for internal typing

### Components to remove
- `TerminalLog` — replaced by XTermLogViewer
- `TerminalLogRef` — replaced by XTermLogViewerRef
- `TerminalToolbar` — not used by either viewer (controls are inline)
