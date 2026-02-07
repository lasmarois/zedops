# M9.8.34 - PUID Display Bug Fix

**Status:** COMPLETE
**Completed:** 2026-01-15
**Duration:** ~15 minutes

---

## Problem Statement

Configuration tab showed "1000" for PUID when the setting was never set by the user, instead of indicating it was using the image default (1430).

---

## Root Cause Analysis

Two bugs were identified:

### Bug 1: Incorrect Display Fallback

**File:** `ConfigurationDisplay.tsx` line 167
**Issue:** Fallback value was '1000' but actual image default is '1430'
```typescript
// BEFORE (wrong)
config.PUID || `${getDefault('PUID', '1000')} (image default)`

// AFTER (correct)
config.PUID || `${getDefault('PUID', '1430')} (image default)`
```

### Bug 2: Edit Form Polluting Config

**File:** `ConfigurationEdit.tsx` line 38
**Issue:** Form defaulted to '1430' when PUID wasn't set, then saved it even without user changes
```typescript
// BEFORE (pollutes config)
const [puid, setPuid] = useState(config.PUID || '1430')

// AFTER (clean - only saves if user sets a value)
const [puid, setPuid] = useState(config.PUID || '')
```

The handleSubmit logic was already correct (`if (puid) { newConfig.PUID = puid }`), so changing the default to empty string prevents pollution.

---

## Files Modified

1. `frontend/src/components/ConfigurationDisplay.tsx`
   - Line 167: Changed fallback from '1000' to '1430'

2. `frontend/src/components/ConfigurationEdit.tsx`
   - Line 38: Changed default from '1430' to '' (empty string)

---

## Expected Behavior After Fix

1. **New servers** (no PUID set):
   - Display shows: "1430 (image default)"
   - Edit form shows: empty input with placeholder "1430"
   - Saving without changes: PUID remains unset

2. **Existing servers** (PUID previously set):
   - Display shows: the stored value (e.g., "1000" or "1430")
   - Edit form shows: the stored value
   - To clear: manually clear and save (will remove PUID from config)

---

## Related History

- M9.8.30 implemented image defaults API to fetch actual image ENV values
- The fallback values were meant as last resort when API fails
- The wrong '1000' fallback was from before M9.8.30 when we didn't know the actual value
