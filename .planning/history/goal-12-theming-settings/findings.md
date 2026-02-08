# Goal #12: Findings

## Theme System Architecture
- All colors defined in `frontend/src/index.css` as CSS custom properties in HSL format
- Tailwind config (`tailwind.config.js`) maps CSS vars to utility classes
- Logo gradient: `from-primary to-info` in Sidebar.tsx and MainLayout.tsx
- Only need to change `index.css` for a complete theme swap
- Font (Outfit) and monospace font (JetBrains Mono) stay constant
- Border radius (`--radius: 0.5rem`) stays constant
- Animations (shimmer, gradient-rotate) stay constant

## Key CSS Variable Groups
1. **Surfaces**: background, card, popover, muted, secondary, accent
2. **Text**: foreground, card-foreground, muted-foreground
3. **Brand**: primary, primary-foreground, ring
4. **Status**: success, warning, error, info
5. **Chrome**: border, input
6. **Charts**: chart-1 through chart-5

## What Changes Per Theme
- All surface colors (background/card/popover)
- Primary accent color
- Info color (used in logo gradient)
- Status colors for harmony
- Border/input colors
- Chart colors to match

## What Stays Constant
- HSL format (required by Tailwind mapping)
- Variable names (required by Tailwind config)
- Font families
- Border radius
- Animations
