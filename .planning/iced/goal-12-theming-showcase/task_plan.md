# Goal #12: Theming Showcase

Parent: M16 (Theming Showcase)

## Context

Try 5 different color themes for ZedOps. Each theme lives on its own git branch.
Only `index.css` CSS variables need changing — the entire UI derives from them.
We cycle through themes by merging each branch into `dev`, testing, then resetting.

## Approach

- One branch per theme, branched from `dev`
- Each branch modifies ONLY `frontend/src/index.css` (CSS custom properties)
- The logo gradient auto-derives from `--primary` and `--info` vars
- Status colors (success/warning/error) may change per theme for harmony

---

## Theme Branches

### 1. `theme/cyberpunk-neon` — Neon Cyberpunk
- Hot pink primary, electric cyan info, deep purple background
- Inspired by cyberpunk aesthetics, neon signs
- High contrast, vibrant accents

### 2. `theme/emerald-dark` — Emerald Night
- Emerald green primary, teal info, deep forest background
- Nature-inspired but dark, Matrix-like feel
- Calm, professional with green energy

### 3. `theme/amber-forge` — Amber Forge
- Warm amber/gold primary, burnt orange info, charcoal background
- Industrial, forge-like warmth
- Cozy, warm tones throughout

### 4. `theme/arctic-frost` — Arctic Frost
- Ice blue primary, pale violet info, slate blue-grey background
- Cold, clean, Scandinavian minimalism
- Very subtle, muted, professional

### 5. `theme/solar-flare` — Solar Flare
- Bright orange primary, vivid yellow info, near-black warm background
- Sun/fire energy, bold and energetic
- Striking contrast, attention-grabbing

---

## Phases

### Phase 1: Create all 5 theme branches ✅
- [x] 1.1 Create `theme/cyberpunk-neon` branch with CSS changes
- [x] 1.2 Create `theme/emerald-dark` branch with CSS changes
- [x] 1.3 Create `theme/amber-forge` branch with CSS changes
- [x] 1.4 Create `theme/arctic-frost` branch with CSS changes
- [x] 1.5 Create `theme/solar-flare` branch with CSS changes

### Phase 2: Test first theme on dev
- [ ] 2.1 Merge first theme into dev
- [ ] 2.2 Push to dev, verify on zedops-dev
- [ ] 2.3 Take screenshots for comparison

---

## Current Base Theme (Midnight Blue)
```css
--background: 220 45% 12%;        /* #0C1628 */
--card: 220 40% 16%;              /* #151F33 */
--primary: 217 91% 60%;           /* #3B82F6 */
--info: 199 92% 65%;              /* #33E1FF */
--success: 142 71% 65%;           /* #3DDC97 */
--warning: 38 95% 65%;            /* #FFC952 */
--error: 0 88% 68%;               /* #F75555 */
--border: 217 32% 30%;            /* #374151 */
--muted-foreground: 215 20% 70%;  /* #9CA3AF */
```
