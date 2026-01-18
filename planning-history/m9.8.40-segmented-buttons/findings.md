# M9.8.40 - Research Findings

## Current Implementation Analysis

**Location:** `frontend/src/pages/ServerDetail.tsx` (lines 291-318)

### Current Button Layout
```tsx
<div className="flex gap-2">
  {status === 'stopped' && (
    <Button variant="success">Start</Button>
  )}
  {status === 'running' && (
    <>
      <Button variant="warning">Stop</Button>
      <Button variant="info">Restart</Button>
    </>
  )}
  <Button variant="info">Rebuild</Button>
  <Button variant="destructive">Delete</Button>
</div>
```

### Existing Button Component Features
- Rounded corners (`rounded-lg`)
- Shadow effects on hover
- Color-coded variants (success, warning, info, destructive)
- Icon + text layout
- Loading states supported

### Theme Colors Available
- `--success: 142 71% 65%` (#3DDC97 - emerald green)
- `--warning: 38 95% 65%` (#FFC952 - gold/amber)
- `--info: 199 92% 65%` (#33E1FF - electric cyan)
- `--destructive: 0 84% 60%` (#DC2626 - red)
- `--primary: 217 91% 60%` (#3B82F6 - blue)

### Design Considerations
1. **Midnight blue theme** - Dark backgrounds, vibrant accents
2. **Glass morphism** - Already used in migration progress bar
3. **Glow effects** - Button shadows already have `hover:shadow-md hover:shadow-{color}/20`
4. **Consistency** - Should match existing UI patterns

## Inspiration References

### Option 1 (Segmented)
- macOS window controls
- Figma toolbar groups
- Linear app action bars

### Option 3 (Icon-First)
- Discord voice controls
- Figma toolbar
- VS Code status bar

### Option 5 (Gradient Border)
- Gaming dashboards
- Crypto trading platforms
- Premium SaaS UIs

## Technical Notes

### For Glass Morphism
```css
backdrop-filter: blur(10px);
background: rgba(255, 255, 255, 0.1);
border: 1px solid rgba(255, 255, 255, 0.1);
```

### For Animated Gradient Border
```css
background: conic-gradient(from 0deg, #3DDC97, #33E1FF, #3B82F6, #3DDC97);
animation: rotate 3s linear infinite;
```

### For Glow Effect
```css
box-shadow: 0 0 20px rgba(61, 220, 151, 0.4);
```
