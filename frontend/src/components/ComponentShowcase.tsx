/**
 * Component Showcase - M9 Phase 1 Testing
 *
 * Demonstrates new components:
 * - StatusBadge (text-only variants)
 * - ActivityTimeline (expandable)
 * - LogViewer (Smart Hybrid)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { StatusBadge } from './ui/status-badge';
import { ActivityTimeline, type ActivityEvent } from './ui/activity-timeline';
import { LogViewer } from './ui/log-viewer';
import { Button } from './ui/button';

const FONTS = [
  { name: 'Space Grotesk', value: 'Space Grotesk', description: 'Geometric, distinctive, modern tech' },
  { name: 'Inter', value: 'Inter', description: 'Clean, professional, highly readable' },
  { name: 'Outfit', value: 'Outfit', description: 'Rounded, friendly, approachable' },
  { name: 'Manrope', value: 'Manrope', description: 'Semi-rounded geometric, professional' },
  { name: 'Archivo', value: 'Archivo', description: 'Sharp, technical, modern' },
  { name: 'DM Sans', value: 'DM Sans', description: 'Clean geometric sans-serif' },
];

export function ComponentShowcase() {
  const [selectedFont, setSelectedFont] = useState('Outfit');

  // Sample data for ActivityTimeline
  const sampleEvents: ActivityEvent[] = [
    {
      id: '1',
      timestamp: '2 minutes ago',
      user: 'admin',
      action: 'started',
      target: 'server jeanguy',
      actionColor: 'success' as const,
      details: {
        'Event ID': 'evt_1234567890abcdef',
        'Timestamp': '2026-01-13 14:23:45 UTC',
        'Duration': '2.3 seconds',
        'Status': 'Success ✓',
      },
    },
    {
      id: '2',
      timestamp: '5 minutes ago',
      user: 'john',
      action: 'kicked',
      target: 'player griefer123 from build42',
      actionColor: 'warning' as const,
      details: {
        'Event ID': 'evt_abcdef1234567890',
        'Reason': 'Griefing',
        'Duration': '0.1 seconds',
      },
    },
    {
      id: '3',
      timestamp: '12 minutes ago',
      user: 'system',
      action: 'came online',
      target: 'Agent maestroserver',
      actionColor: 'info' as const,
    },
    {
      id: '4',
      timestamp: '1 hour ago',
      user: 'admin',
      action: 'deleted',
      target: 'server old-test',
      actionColor: 'error' as const,
      details: {
        'Event ID': 'evt_9876543210fedcba',
        'Server ID': 'srv_old_test_123',
        'Data Purged': 'Yes',
      },
    },
  ];

  // Sample data for LogViewer
  const sampleLogs = [
    {
      timestamp: '12:34:56',
      level: 'INFO' as const,
      message: 'Server started on port 16261',
    },
    {
      timestamp: '12:35:02',
      level: 'INFO' as const,
      message: "Player 'John' connected (Steam ID: 76561198012345678)",
    },
    {
      timestamp: '12:35:15',
      level: 'DEBUG' as const,
      message: 'Loading world chunk (0, 0)',
    },
    {
      timestamp: '12:35:45',
      level: 'WARN' as const,
      message: 'High memory usage (1.8GB/2GB)',
    },
    {
      timestamp: '12:36:12',
      level: 'ERROR' as const,
      message: 'Connection timeout to Steam API',
      details: {
        context: {
          'Endpoint': 'api.steampowered.com:443',
          'Timeout': '30 seconds',
          'Retry': 'Attempt 1/3 in progress',
        },
        stackTrace: `at SteamClient.connect (steam.js:45)
at GameServer.init (server.js:123)
at async main (index.js:8)`,
      },
    },
    {
      timestamp: '12:36:15',
      level: 'INFO' as const,
      message: 'Successfully connected to Steam API',
    },
    {
      timestamp: '12:37:22',
      level: 'INFO' as const,
      message: "Player 'Sarah' connected",
    },
    {
      timestamp: '12:38:01',
      level: 'INFO' as const,
      message: 'Autosaving world...',
    },
  ];

  return (
    <div className="min-h-screen bg-background p-8" style={{ fontFamily: selectedFont }}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Component Showcase
          </h1>
          <p className="text-muted-foreground">
            M9 Phase 1: Midnight Blue Theme + New Components
          </p>
          <p className="text-xs text-muted-foreground mt-2 font-mono">
            Current Font: {selectedFont} | Mono: JetBrains Mono
          </p>
        </div>

        {/* Font Picker */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>🎨 Font Picker - Try Them All!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {FONTS.map((font) => (
                <Button
                  key={font.value}
                  variant={selectedFont === font.value ? 'default' : 'outline'}
                  onClick={() => setSelectedFont(font.value)}
                  className="h-auto py-3 px-4 flex flex-col items-start gap-1"
                >
                  <span className="font-semibold text-sm">{font.name}</span>
                  <span className="text-xs opacity-70 font-normal text-left">
                    {font.description}
                  </span>
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Click any font to apply it instantly to the entire page. All fonts are already loaded!
            </p>
          </CardContent>
        </Card>

        {/* Font System Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Typography System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">UI Font: {selectedFont}</h3>
              <div className="space-y-2">
                <p className="text-3xl font-bold">The quick brown fox jumps</p>
                <p className="text-xl font-semibold">The quick brown fox jumps</p>
                <p className="text-base font-medium">The quick brown fox jumps over the lazy dog</p>
                <p className="text-sm">The quick brown fox jumps over the lazy dog</p>
                <p className="text-sm">ZedOps Infrastructure Management • 0O1lI</p>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Mono Font: JetBrains Mono</h3>
              <div className="space-y-2 font-mono">
                <p className="text-base">const server = "jeanguy";</p>
                <p className="text-sm">INFO: Server started on port 16261</p>
                <p className="text-sm">0O1lI - Character distinction test</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Color System Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Color System - Midnight Blue Theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="h-20 bg-background border border-border rounded-lg mb-2"></div>
                <p className="text-sm text-muted-foreground">Background</p>
                <p className="text-xs font-mono">#0C1628</p>
              </div>
              <div>
                <div className="h-20 bg-card border border-border rounded-lg mb-2"></div>
                <p className="text-sm text-muted-foreground">Card</p>
                <p className="text-xs font-mono">#151F33</p>
              </div>
              <div>
                <div className="h-20 bg-primary rounded-lg mb-2"></div>
                <p className="text-sm text-muted-foreground">Primary</p>
                <p className="text-xs font-mono">#3B82F6</p>
              </div>
              <div>
                <div className="h-20 bg-secondary rounded-lg mb-2"></div>
                <p className="text-sm text-muted-foreground">Secondary</p>
                <p className="text-xs font-mono">#1F2937</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="h-20 bg-success rounded-lg mb-2 shadow-lg shadow-success/20"></div>
                <p className="text-sm text-muted-foreground">Success</p>
                <p className="text-xs font-mono text-success">#3DDC97</p>
                <p className="text-xs text-muted-foreground">Vibrant emerald</p>
              </div>
              <div>
                <div className="h-20 bg-warning rounded-lg mb-2 shadow-lg shadow-warning/20"></div>
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-xs font-mono text-warning">#FFC952</p>
                <p className="text-xs text-muted-foreground">Polished gold</p>
              </div>
              <div>
                <div className="h-20 bg-error rounded-lg mb-2 shadow-lg shadow-error/20"></div>
                <p className="text-sm text-muted-foreground">Error</p>
                <p className="text-xs font-mono text-error">#F75555</p>
                <p className="text-xs text-muted-foreground">Vibrant red</p>
              </div>
              <div>
                <div className="h-20 bg-info rounded-lg mb-2 shadow-lg shadow-info/20"></div>
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-xs font-mono text-info">#33E1FF</p>
                <p className="text-xs text-muted-foreground">Electric cyan</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* StatusBadge Showcase */}
        <Card>
          <CardHeader>
            <CardTitle>StatusBadge Component (Native Icons)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icon Types */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Icon Styles</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Default Dot</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="success" icon="dot">Online</StatusBadge>
                    <StatusBadge variant="error" icon="dot">Offline</StatusBadge>
                    <StatusBadge variant="warning" icon="dot">Warning</StatusBadge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Pulsing (Active)</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="success" icon="pulse">Running</StatusBadge>
                    <StatusBadge variant="info" icon="pulse">Processing</StatusBadge>
                    <StatusBadge variant="warning" icon="pulse">Starting</StatusBadge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Check Mark</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="success" icon="check">Healthy</StatusBadge>
                    <StatusBadge variant="success" icon="check">Verified</StatusBadge>
                    <StatusBadge variant="info" icon="check">Synced</StatusBadge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Alert Triangle</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="warning" icon="alert">Degraded</StatusBadge>
                    <StatusBadge variant="error" icon="alert">Critical</StatusBadge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Cross (Error)</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="error" icon="cross">Failed</StatusBadge>
                    <StatusBadge variant="error" icon="cross">Disconnected</StatusBadge>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Info Circle</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge variant="info" icon="info">Updating</StatusBadge>
                    <StatusBadge variant="muted" icon="info">Stopped</StatusBadge>
                  </div>
                </div>
              </div>
            </div>

            {/* Server Status Examples */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Server Status Examples</h3>
              <div className="flex flex-wrap gap-2">
                <StatusBadge variant="success" icon="pulse">Running</StatusBadge>
                <StatusBadge variant="muted" icon="info">Stopped</StatusBadge>
                <StatusBadge variant="warning" icon="pulse">Starting</StatusBadge>
                <StatusBadge variant="error" icon="cross">Failed</StatusBadge>
                <StatusBadge variant="info" icon="pulse">Updating</StatusBadge>
                <StatusBadge variant="warning" icon="alert">Degraded</StatusBadge>
                <StatusBadge variant="success" icon="check">Healthy</StatusBadge>
              </div>
            </div>

            {/* Size Variants */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Size Variants</h3>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge variant="success" icon="check" size="sm">Small</StatusBadge>
                <StatusBadge variant="success" icon="check" size="md">Medium</StatusBadge>
                <StatusBadge variant="success" icon="check" size="lg">Large</StatusBadge>
              </div>
            </div>

            {/* Icon-Only Mode */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Icon-Only Mode (Table Cells)</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <StatusBadge variant="success" icon="dot" iconOnly />
                  <span className="text-sm">Server 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="error" icon="dot" iconOnly />
                  <span className="text-sm">Server 2</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="warning" icon="dot" iconOnly />
                  <span className="text-sm">Server 3</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge variant="success" icon="pulse" iconOnly />
                  <span className="text-sm">Server 4</span>
                </div>
              </div>
            </div>

            {/* Comparison: Old vs New */}
            <div className="bg-muted/5 p-4 rounded-lg border border-border">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Before vs After</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">Before:</span>
                  <span className="text-sm">🟢 Online</span>
                  <span className="text-sm">🔴 Offline</span>
                  <span className="text-sm">🟡 Warning</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">After:</span>
                  <StatusBadge variant="success" icon="pulse">Online</StatusBadge>
                  <StatusBadge variant="error" icon="cross">Offline</StatusBadge>
                  <StatusBadge variant="warning" icon="alert">Warning</StatusBadge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Icon Gallery - All Variations */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Icon Gallery - All Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* A: Square Icons */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-success blur-sm opacity-20" />
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">A</div>
                  <div className="text-xs text-muted-foreground">Square</div>
                </div>
              </div>

              {/* B: Circle Icons */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-success blur-sm opacity-20" />
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-success/10 ring-2 ring-success/20">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">B</div>
                  <div className="text-xs text-muted-foreground">Circle</div>
                </div>
              </div>

              {/* C: User Avatar */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary blur-sm opacity-20" />
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-2 ring-primary/20">
                    <span className="text-sm font-bold text-primary">A</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">C</div>
                  <div className="text-xs text-muted-foreground">User Letter</div>
                </div>
              </div>

              {/* D: Minimal Dot */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9">
                  <div className="w-2 h-2 rounded-full bg-success shadow-lg shadow-success/50" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">D</div>
                  <div className="text-xs text-muted-foreground">Minimal Dot</div>
                </div>
              </div>

              {/* E: No Icon */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9">
                  <span className="text-xs text-muted-foreground">—</span>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">E</div>
                  <div className="text-xs text-muted-foreground">No Icon</div>
                </div>
              </div>

              {/* F: Icon Badge */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9">
                  <div className="flex items-center justify-center w-5 h-5 rounded-md bg-success/10">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                      <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">F</div>
                  <div className="text-xs text-muted-foreground">Compact</div>
                </div>
              </div>

              {/* G: Soft Square */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-success blur-sm opacity-20" />
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-success/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">G</div>
                  <div className="text-xs text-muted-foreground">Soft Square</div>
                </div>
              </div>

              {/* H: Hexagon */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <svg width="36" height="36" viewBox="0 0 36 36" className="absolute">
                    <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="currentColor" className="text-success/10" />
                    <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="currentColor" strokeWidth="1" className="text-success/20" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success relative">
                    <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">H</div>
                  <div className="text-xs text-muted-foreground">Hexagon</div>
                </div>
              </div>

              {/* I: Diamond */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <div className="absolute inset-0 rotate-45 bg-success/10 rounded-sm" />
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success relative">
                    <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">I</div>
                  <div className="text-xs text-muted-foreground">Diamond</div>
                </div>
              </div>

              {/* J: Pill Shape */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="flex items-center justify-center w-12 h-7 rounded-full bg-success/10">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">J</div>
                  <div className="text-xs text-muted-foreground">Pill</div>
                </div>
              </div>

              {/* K: Octagon */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <svg width="36" height="36" viewBox="0 0 36 36" className="absolute">
                    <polygon points="11,2 25,2 34,11 34,25 25,34 11,34 2,25 2,11" fill="currentColor" className="text-success/10" />
                  </svg>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success relative">
                    <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">K</div>
                  <div className="text-xs text-muted-foreground">Octagon</div>
                </div>
              </div>

              {/* L: Vertical Bar */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9">
                  <div className="w-1 h-9 rounded-full bg-success shadow-sm" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">L</div>
                  <div className="text-xs text-muted-foreground">Vertical Bar</div>
                </div>
              </div>

              {/* M: Colored Block */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9">
                  <div className="w-9 h-9 rounded-lg bg-success" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">M</div>
                  <div className="text-xs text-muted-foreground">Solid Block</div>
                </div>
              </div>

              {/* N: Outline Only */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full ring-2 ring-success">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">N</div>
                  <div className="text-xs text-muted-foreground">Outline</div>
                </div>
              </div>

              {/* O: Gradient */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-success/20 to-success/5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">O</div>
                  <div className="text-xs text-muted-foreground">Gradient</div>
                </div>
              </div>

              {/* P: Duotone */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.3" />
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">P</div>
                  <div className="text-xs text-muted-foreground">Duotone</div>
                </div>
              </div>

              {/* Q: Shadow Only */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success drop-shadow-lg">
                    <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">Q</div>
                  <div className="text-xs text-muted-foreground">Floating</div>
                </div>
              </div>

              {/* R: Action Icon */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                      <path d="M8 3V8L11 11" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="8" cy="8" r="6" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">R</div>
                  <div className="text-xs text-muted-foreground">Action Icon</div>
                </div>
              </div>

              {/* S: Emoji */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-success/10">
                    <span className="text-lg">✅</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">S</div>
                  <div className="text-xs text-muted-foreground">Emoji</div>
                </div>
              </div>

              {/* T: Combo */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-2 ring-primary/20">
                    <span className="text-sm font-bold text-primary">A</span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-success ring-2 ring-background">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="2" className="text-background">
                      <path d="M1 4L3 6L7 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">T</div>
                  <div className="text-xs text-muted-foreground">Combo</div>
                </div>
              </div>

              {/* U: Number */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-muted/20 ring-2 ring-border">
                    <span className="text-sm font-bold text-muted-foreground">#1</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">U</div>
                  <div className="text-xs text-muted-foreground">Number</div>
                </div>
              </div>

              {/* V: Pulsing (animate later) */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-success blur-sm opacity-20 animate-pulse" />
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-success/10 ring-2 ring-success/20">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">V</div>
                  <div className="text-xs text-muted-foreground">Pulsing</div>
                </div>
              </div>

              {/* W: Accent Line */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex flex-col items-center gap-1">
                    <div className="w-6 h-0.5 rounded-full bg-success" />
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                        <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">W</div>
                  <div className="text-xs text-muted-foreground">Accent Line</div>
                </div>
              </div>

              {/* X: Stacked */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <div className="absolute top-0 left-0 w-7 h-7 rounded-full bg-success/20" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-success/30" />
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success relative">
                    <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">X</div>
                  <div className="text-xs text-muted-foreground">Stacked</div>
                </div>
              </div>

              {/* Y: Corner Flag */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-muted/10 ring-2 ring-border">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 rounded-sm bg-success" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">Y</div>
                  <div className="text-xs text-muted-foreground">Corner Flag</div>
                </div>
              </div>

              {/* Z: Glow Pulse (animate later) */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="absolute inset-0 rounded-lg bg-success blur-md opacity-30 animate-pulse" />
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-success/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">Z</div>
                  <div className="text-xs text-muted-foreground">Glow Pulse</div>
                </div>
              </div>

              {/* AA: Initial + Ring */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-2 ring-success">
                    <span className="text-sm font-bold text-primary">A</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AA</div>
                  <div className="text-xs text-muted-foreground">Initial+Ring</div>
                </div>
              </div>

              {/* AB: Badge on Color */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-success/20">
                    <div className="flex items-center justify-center w-5 h-5 rounded-md bg-success">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="text-background">
                        <path d="M2 5L4 7L8 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AB</div>
                  <div className="text-xs text-muted-foreground">Badge+BG</div>
                </div>
              </div>

              {/* AC: Split Circle */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <div className="absolute inset-0 rounded-full overflow-hidden">
                    <div className="absolute inset-0 w-1/2 bg-primary/20" />
                    <div className="absolute inset-0 left-1/2 bg-success/20" />
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success relative">
                    <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AC</div>
                  <div className="text-xs text-muted-foreground">Split Circle</div>
                </div>
              </div>

              {/* AD: Top Accent */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-9 h-0.5 rounded-full bg-success" />
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/10">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground">
                        <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AD</div>
                  <div className="text-xs text-muted-foreground">Top Accent</div>
                </div>
              </div>

              {/* AE: Nested */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full ring-2 ring-success/30">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-success/10">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                        <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AE</div>
                  <div className="text-xs text-muted-foreground">Nested</div>
                </div>
              </div>

              {/* AF: Dot + Icon */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="flex items-center justify-center w-9 h-9 gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-success shadow-sm" />
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                    <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AF</div>
                  <div className="text-xs text-muted-foreground">Dot+Icon</div>
                </div>
              </div>

              {/* AG: Corner Icon (would be on card) */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30 relative">
                <div className="flex items-center justify-center w-9 h-9">
                  <span className="text-xs text-muted-foreground">Card</span>
                </div>
                <div className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-md bg-success/20">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                    <path d="M2 5L4 7L8 3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AG</div>
                  <div className="text-xs text-muted-foreground">In Corner</div>
                </div>
              </div>

              {/* AH: Soft Glow */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <div className="absolute inset-0 rounded-full bg-success blur-xl opacity-40" />
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success relative">
                    <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AH</div>
                  <div className="text-xs text-muted-foreground">Soft Glow</div>
                </div>
              </div>

              {/* AI: Arrow */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative flex items-center justify-center w-9 h-9">
                  <div className="flex items-center gap-0.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                      <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="text-success">
                      <path d="M4 0L8 4L4 8V0Z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AI</div>
                  <div className="text-xs text-muted-foreground">W/ Arrow</div>
                </div>
              </div>

              {/* AJ: Overlay */}
              <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border bg-card/30">
                <div className="relative">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-2 ring-primary/20">
                    <span className="text-sm font-bold text-primary">A</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-success ring-1 ring-background">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-background">
                      <path d="M1 4L3 6L7 2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-primary">AJ</div>
                  <div className="text-xs text-muted-foreground">Overlay</div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted/20 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground">
                💬 <strong>Pick your favorites!</strong> Tell me which letters (A-AJ) you'd like to see in full activity timeline examples.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ActivityTimeline Showcase - Multiple Layouts */}
        <Card>
          <CardHeader>
            <CardTitle>ActivityTimeline Component (Card Style)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Icon Avatar Options */}
            <div className="space-y-6">
              <h3 className="text-sm font-semibold text-muted-foreground">Choose Your Icon Style</h3>

              {/* Option A: Square icons (current) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">A</span>
                  <span className="text-sm font-medium">Square Icons (Current)</span>
                </div>
                <div className="bg-card/50 rounded-lg p-4 border border-border">
                  <ActivityTimeline events={sampleEvents.slice(0, 2)} />
                </div>
              </div>

              {/* Option B: Circle icons */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">B</span>
                  <span className="text-sm font-medium">Circle Icons (Classic)</span>
                </div>
                <div className="bg-card/50 rounded-lg p-4 border border-border space-y-2">
                  {sampleEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="group hover:bg-muted/30 rounded-lg p-3 transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        {/* Circle icon */}
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 rounded-full bg-success blur-sm opacity-20" />
                          <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-success/10 ring-2 ring-success/20">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                              <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{event.user}</span>
                            <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge variant={event.actionColor} size="sm">{event.action}</StatusBadge>
                            <span className="text-sm text-foreground/90">{event.target}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option C: User avatar (first letter) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">C</span>
                  <span className="text-sm font-medium">User Avatar (First Letter)</span>
                </div>
                <div className="bg-card/50 rounded-lg p-4 border border-border space-y-2">
                  {sampleEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="group hover:bg-muted/30 rounded-lg p-3 transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        {/* User avatar */}
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 rounded-full bg-primary blur-sm opacity-20" />
                          <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-2 ring-primary/20">
                            <span className="text-sm font-bold text-primary uppercase">{event.user.charAt(0)}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{event.user}</span>
                            <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge variant={event.actionColor} size="sm">{event.action}</StatusBadge>
                            <span className="text-sm text-foreground/90">{event.target}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option D: Minimal dot */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">D</span>
                  <span className="text-sm font-medium">Minimal Dot (Clean)</span>
                </div>
                <div className="bg-card/50 rounded-lg p-4 border border-border space-y-2">
                  {sampleEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="group hover:bg-muted/30 rounded-lg p-3 transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        {/* Minimal dot */}
                        <div className="relative flex-shrink-0 mt-1.5">
                          <div className="w-2 h-2 rounded-full bg-success shadow-lg shadow-success/50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{event.user}</span>
                            <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge variant={event.actionColor} size="sm">{event.action}</StatusBadge>
                            <span className="text-sm text-foreground/90">{event.target}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option E: No icon (text only) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">E</span>
                  <span className="text-sm font-medium">No Icon (Ultra Minimal)</span>
                </div>
                <div className="bg-card/50 rounded-lg p-4 border border-border space-y-2">
                  {sampleEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="group hover:bg-muted/30 rounded-lg p-3 transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{event.user}</span>
                            <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge variant={event.actionColor} size="sm">{event.action}</StatusBadge>
                            <span className="text-sm text-foreground/90">{event.target}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option F: Icon badge (small, inline) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">F</span>
                  <span className="text-sm font-medium">Icon Badge (Compact)</span>
                </div>
                <div className="bg-card/50 rounded-lg p-4 border border-border space-y-2">
                  {sampleEvents.slice(0, 2).map((event) => (
                    <div key={event.id} className="group hover:bg-muted/30 rounded-lg p-3 transition-all duration-200 border border-transparent hover:border-border hover:shadow-sm">
                      <div className="flex items-start gap-3">
                        {/* Small icon badge */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-success/10">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                              <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm font-semibold text-foreground">{event.user}</span>
                            <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge variant={event.actionColor} size="sm">{event.action}</StatusBadge>
                            <span className="text-sm text-foreground/90">{event.target}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/20 rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground">
                  💬 <strong>Which icon style do you prefer?</strong> Choose A, B, C, D, E, or F - or suggest a variation!
                </p>
              </div>
            </div>

            {/* Alternative layouts section (collapsed) */}
            <details className="group">
              <summary className="text-sm font-semibold mb-4 text-muted-foreground cursor-pointer list-none flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-90">
                  <path d="M6 4L10 8L6 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                See Other Layout Options
              </summary>

            <div className="space-y-8 mt-4 ml-6">
            {/* Option 2: Inline with badge */}
            <div>
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/20 text-muted-foreground text-xs font-bold">2</span>
                Timeline with Badge
              </h3>
              <div className="bg-card/50 rounded-lg p-4 border border-border">
                <div className="space-y-0">
                  {sampleEvents.slice(0, 2).map((event, index) => (
                    <div key={event.id} className="group relative">
                      {index < 1 && (
                        <div className="absolute left-[10px] top-8 bottom-0 w-px bg-border opacity-30" />
                      )}
                      <div className="flex items-start gap-4 pb-6">
                        {/* Icon */}
                        <div className="relative flex-shrink-0 mt-1">
                          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-success/10 ring-4 ring-background">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                              <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground mb-1.5">{event.timestamp}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-primary">{event.user}</span>
                            <StatusBadge variant={event.actionColor} size="sm">{event.action}</StatusBadge>
                            <span className="text-sm text-foreground/90">{event.target}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Option 3: Card-based compact */}
            <div>
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                Card-Based (Slack/Discord Style)
              </h3>
              <div className="bg-card/50 rounded-lg p-4 border border-border space-y-2">
                {sampleEvents.slice(0, 2).map((event) => (
                  <div key={event.id} className="group hover:bg-muted/30 rounded-lg p-3 transition-colors border border-transparent hover:border-border">
                    <div className="flex items-start gap-3">
                      {/* Icon as avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-success/10">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                            <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground">{event.user}</span>
                          <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                        </div>
                        <div className="text-sm text-foreground/80">
                          <span className="text-success font-medium">{event.action}</span> {event.target}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Option 4: Sentence flow with icon */}
            <div>
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                Natural Sentence Flow
              </h3>
              <div className="bg-card/50 rounded-lg p-4 border border-border">
                <div className="space-y-0">
                  {sampleEvents.slice(0, 2).map((event, index) => (
                    <div key={event.id} className="group relative">
                      {index < 1 && (
                        <div className="absolute left-[10px] top-8 bottom-0 w-px bg-border opacity-30" />
                      )}
                      <div className="flex items-start gap-4 pb-6">
                        {/* Icon */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-success/10 ring-4 ring-background">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                              <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground font-medium mb-1">{event.timestamp}</div>
                          <p className="text-sm leading-relaxed">
                            <span className="font-semibold text-primary">{event.user}</span>
                            {' '}
                            <span className="text-success font-medium">{event.action}</span>
                            {' '}
                            <span className="text-foreground font-medium">{event.target}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Option 5: Table-like structure */}
            <div>
              <h3 className="text-sm font-semibold mb-4 text-muted-foreground flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
                Structured Table Style
              </h3>
              <div className="bg-card/50 rounded-lg p-4 border border-border">
                <div className="space-y-0">
                  {sampleEvents.slice(0, 2).map((event, index) => (
                    <div key={event.id} className="group relative">
                      {index < 1 && (
                        <div className="absolute left-[10px] top-8 bottom-0 w-px bg-border opacity-30" />
                      )}
                      <div className="flex items-start gap-4 pb-6">
                        {/* Icon */}
                        <div className="relative flex-shrink-0 mt-1.5">
                          <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-success/10 ring-4 ring-background">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                              <path d="M2.5 7L5.5 10L11.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="grid grid-cols-[80px_80px_1fr] gap-4 items-baseline">
                            <span className="text-xs text-muted-foreground font-medium">{event.timestamp}</span>
                            <span className="text-sm font-semibold text-primary">{event.user}</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-success font-medium text-sm">{event.action}</span>
                              <span className="text-foreground/80 text-sm">{event.target}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            </div>
            </details>
          </CardContent>
        </Card>

        {/* LogViewer Showcase */}
        <Card>
          <CardHeader>
            <CardTitle>LogViewer Component (Smart Hybrid)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-background rounded-lg p-4 border border-border">
              <LogViewer logs={sampleLogs} />
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              ℹ️ INFO/DEBUG logs are compact, WARN logs are highlighted, ERROR logs auto-expand with details
            </p>
          </CardContent>
        </Card>

        {/* Button Showcase */}
        <Card>
          <CardHeader>
            <CardTitle>Button Variants (Enhanced)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filled variants with shadow glow */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Filled Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="default">Primary</Button>
                <Button variant="success">Success</Button>
                <Button variant="warning">Warning</Button>
                <Button variant="info">Info</Button>
                <Button variant="destructive">Destructive</Button>
              </div>
            </div>

            {/* Outline and ghost variants */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Outline & Ghost</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline">Outline</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </div>

            {/* Size variants */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Size Variants</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default" size="sm">Small</Button>
                <Button variant="default" size="default">Default</Button>
                <Button variant="default" size="lg">Large</Button>
              </div>
            </div>

            {/* With icons */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">With Icons</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="success">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 8L6 11L13 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Save Changes
                </Button>
                <Button variant="destructive">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 4L12 12M12 4L4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Delete
                </Button>
                <Button variant="info">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3V8L11 11" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="8" cy="8" r="6" />
                  </svg>
                  Schedule
                </Button>
              </div>
            </div>

            {/* Disabled state */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Disabled State</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="default" disabled>Disabled Primary</Button>
                <Button variant="outline" disabled>Disabled Outline</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
