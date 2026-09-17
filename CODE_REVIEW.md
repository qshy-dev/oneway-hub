# Code Review: ONEWAY HUB

## Critical Issues

### 1. **Infinite Scroll Performance Memory Leak** (Home.tsx)
**Severity:** High
**Location:** `src/components/Home.tsx` - Auto-scroll effect (line ~130)

**Issue:**
```typescript
useEffect(() => {
  const el = scrollRef.current;
  if (!el || containerW === 0) return;
  let raf: number;
  const tick = () => {
    if (!autoScrollPaused.current) {
      el.scrollLeft += 0.15;
      targetScroll.current = el.scrollLeft;
      if (el.scrollLeft >= singleSetWidth * 2) {
        el.scrollLeft -= singleSetWidth;
        targetScroll.current = el.scrollLeft;
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [active, containerW, singleSetWidth]);
```

**Problem:** RAF (`raf`) is being overwritten in every frame. The cleanup only cancels the latest one, but subsequent frames still keep calling `requestAnimationFrame`. This creates a cascading effect that can leak frames and cause memory bloat.

**Fix:**
```typescript
useEffect(() => {
  const el = scrollRef.current;
  if (!el || containerW === 0) return;
  
  const tick = () => {
    if (!autoScrollPaused.current) {
      el.scrollLeft += 0.15;
      targetScroll.current = el.scrollLeft;
      if (el.scrollLeft >= singleSetWidth * 2) {
        el.scrollLeft -= singleSetWidth;
        targetScroll.current = el.scrollLeft;
      }
    }
    const raf = requestAnimationFrame(tick); // Assign inside tick
    return raf;
  };
  let currentRaf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(currentRaf);
}, [active, containerW, singleSetWidth]);
```

Or better yet, use `useRef`:
```typescript
const rafRef = useRef<number>();
useEffect(() => {
  const el = scrollRef.current;
  if (!el || containerW === 0) return;
  
  const tick = () => {
    if (!autoScrollPaused.current) {
      el.scrollLeft += 0.15;
      targetScroll.current = el.scrollLeft;
      if (el.scrollLeft >= singleSetWidth * 2) {
        el.scrollLeft -= singleSetWidth;
        targetScroll.current = el.scrollLeft;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };
  rafRef.current = requestAnimationFrame(tick);
  return () => rafRef.current !== undefined && cancelAnimationFrame(rafRef.current);
}, [active, containerW, singleSetWidth]);
```

---

## High Priority Issues

### 2. **Missing Error Handling in Auth Sync** (auth.tsx)
**Severity:** High
**Location:** `src/lib/auth.tsx` - `syncTwitchProfile` & `onAuthStateChange`

**Issue:**
The auth context doesn't properly handle network failures or stuck promises:
```typescript
supabase.auth.onAuthStateChange((_event, newSession) => {
  setSession(newSession);
  if (newSession?.user) {
    (async () => {
      // ... async operations without try-catch or timeout
    })();
  }
});
```

**Problem:** 
- Async operations in the state change listener can fail silently
- No timeout protection if Supabase is slow
- Could leave state in an incomplete/inconsistent state

**Fix:**
```typescript
const syncAuthData = useCallback(async (newSession: Session | null) => {
  if (!newSession?.user) {
    setProfile(null);
    return;
  }
  
  try {
    // Update Twitch token if available
    if (newSession.provider_token) {
      await supabase
        .from('profiles')
        .update({ twitch_access_token: newSession.provider_token })
        .eq('id', newSession.user.id);
    }
    
    await fetchProfile(newSession.user.id);
    await syncTwitchProfile(newSession);
  } catch (error) {
    console.error('Failed to sync auth data:', error);
    // Optionally show user notification
  }
}, [fetchProfile, syncTwitchProfile]);

supabase.auth.onAuthStateChange(async (_event, newSession) => {
  setSession(newSession);
  if (_event !== 'INITIAL_SESSION') {
    await syncAuthData(newSession);
  }
});
```

---

### 3. **Race Condition in App Tab Switching** (App.tsx)
**Severity:** High
**Location:** `src/App.tsx` - Auction tab switching (lines ~45-52)

**Issue:**
```typescript
const requestAuctionTab = (next: 'auction' | 'wheel') => {
  if (next === auctionTab) return;
  if (auctionTab === 'wheel' && wheelDirtyRef.current) {
    setPendingTabSwitch(next);
    return;
  }
  setAuctionTab(next);
};
```

**Problem:**
- `wheelDirtyRef.current` is mutated directly but state-setting happens asynchronously
- A rapid double-click could create two pending switches
- The modal confirmation happens, but there's a race condition between setting `wheelDirtyRef.current = false` and checking its state

**Fix:**
```typescript
const requestAuctionTab = useCallback((next: 'auction' | 'wheel') => {
  if (next === auctionTab) return;
  if (auctionTab === 'wheel' && wheelDirtyRef.current) {
    setPendingTabSwitch(next);
  } else {
    setAuctionTab(next);
  }
}, [auctionTab]);

// In the confirmation modal:
onClick={() => {
  wheelDirtyRef.current = false;
  setAuctionTab(pendingTabSwitch!);
  setPendingTabSwitch(null);
}}
```

---

### 4. **Stale Closure in Settings Provider** (settings.tsx)
**Severity:** Medium
**Location:** `src/lib/settings.tsx` - `patch` function

**Issue:**
```typescript
const patch = useCallback((p: Partial<AppPrefs>) => {
  setPrefs((prev) => {
    const next: AppPrefs = { ... };
    if (p.accentColor) applyAccent(p.accentColor);
    if (p.theme) applyTheme(p.theme);
    savePrefs(next);
    return next;
  });
}, []); // ← No dependencies!
```

**Problem:** 
- `patch` has an empty dependency array but it's safe in this case (pure function)
- However, the DOM mutation side effects (`applyAccent`, `applyTheme`, `savePrefs`) could potentially fire multiple times or in the wrong order if multiple `patch` calls happen rapidly

**Fix:**
Ensure idempotency:
```typescript
const patch = useCallback((p: Partial<AppPrefs>) => {
  setPrefs((prev) => {
    const next: AppPrefs = {
      includeRandom: p.includeRandom ?? prev.includeRandom,
      includeOwn: p.includeOwn ?? prev.includeOwn,
      ownCode: p.ownCode !== undefined ? p.ownCode : prev.ownCode,
      accentColor: p.accentColor ?? prev.accentColor,
      theme: p.theme ?? prev.theme,
    };
    
    // Only apply if actually changed
    if (next.accentColor !== prev.accentColor) applyAccent(next.accentColor);
    if (next.theme !== prev.theme) applyTheme(next.theme);
    
    savePrefs(next);
    return next;
  });
}, []);
```

---

### 5. **Potential Memory Leak in ResizeObserver** (Home.tsx)
**Severity:** Medium
**Location:** `src/components/Home.tsx` - Container width measurement (lines ~100-107)

**Issue:**
```typescript
useLayoutEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  const update = () => setContainerW(el.clientWidth);
  update();
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

**Problem:** 
ResizeObserver fires callbacks synchronously on size change. Each callback calls `setContainerW`, which can cause multiple re-renders if the container resizes frequently.

**Fix:**
Debounce or throttle the resize:
```typescript
useLayoutEffect(() => {
  const el = scrollRef.current;
  if (!el) return;
  
  let timeoutId: number;
  const update = () => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      setContainerW(el.clientWidth);
    }, 100);
  };
  
  setContainerW(el.clientWidth); // Initial
  const ro = new ResizeObserver(update);
  ro.observe(el);
  return () => {
    clearTimeout(timeoutId);
    ro.disconnect();
  };
}, []);
```

---

## Medium Priority Issues

### 6. **Unchecked Type Assertion** (Home.tsx)
**Severity:** Medium
**Location:** `src/components/Home.tsx` - Line 300+

**Issue:**
```typescript
const roadmapPageItems = filteredRoadmap.slice(
  safeRoadmapPage * ROADMAP_PAGE_SIZE,
  safeRoadmapPage * ROADMAP_PAGE_SIZE + ROADMAP_PAGE_SIZE
);
```

If `filteredRoadmap` is empty and `safeRoadmapPage` tries to access, `slice` returns empty array, which is fine. But the logic assumes `safeRoadmapPage` is always valid. While it's guarded:

```typescript
const safeRoadmapPage = Math.min(roadmapPage, roadmapPageCount - 1);
```

This can return `-1` if `roadmapPageCount === 0`. Fix:

```typescript
const safeRoadmapPage = Math.max(0, Math.min(roadmapPage, Math.max(0, roadmapPageCount - 1)));
```

---

### 7. **Unused State in Home Component** (Home.tsx)
**Severity:** Low
**Location:** `src/components/Home.tsx`

**Issue:**
```typescript
const [roadmapOpen, setRoadmapOpen] = useState(false);
const [roadmapFilters, setRoadmapFilters] = useState<...>(...);
const [roadmapPage, setRoadmapPage] = useState(0);
```

These are only used in one section. While not a bug, it's unnecessary state bloat. Consider moving into a separate sub-component if more features are added.

---

### 8. **Missing Null Coalescing in Profile Display** (Home.tsx)
**Severity:** Low
**Location:** `src/components/Home.tsx` - Lines ~180-195

**Issue:**
```typescript
profile ? (
  <button ...>
    {profile.twitch_avatar ? (
      <img src={profile.twitch_avatar} alt="" className="..." />
    ) : (
      <UserCircle className="..." />
    )}
    <span>
      {profile.twitch_display_name ?? profile.twitch_username ?? 'user'}
    </span>
  </button>
) : (...)
```

**Problem:** 
If `profile` exists but both `twitch_display_name` and `twitch_username` are empty strings (falsy), it will show 'user'. This is actually correct but could be clearer. Minor: the `alt=""` on the img should have meaningful fallback text.

**Fix:**
```typescript
<img 
  src={profile.twitch_avatar} 
  alt={profile.twitch_display_name || profile.twitch_username || 'User avatar'}
  className="..." 
/>
```

---

### 9. **Missing Validation in Color Conversion** (settings.tsx)
**Severity:** Medium
**Location:** `src/lib/settings.tsx` - `hexToRgb`

**Issue:**
```typescript
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 145, g: 70, b: 255 }; // Fallback color
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
```

**Problem:**
- No validation of input (could be very long string, invalid hex chars before parseInt)
- Returns hardcoded fallback which might not match user's previous selection

**Fix:**
```typescript
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Validate input
  const cleanHex = hex.replace('#', '').toLowerCase();
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/.test(cleanHex)) {
    // Return last known good, or throw
    return { r: 145, g: 70, b: 255 };
  }
  
  const full = cleanHex.length === 3 
    ? cleanHex.split('').map((c) => c + c).join('') 
    : cleanHex;
  
  const n = parseInt(full, 16);
  return { 
    r: (n >> 16) & 255, 
    g: (n >> 8) & 255, 
    b: n & 255 
  };
}
```

---

### 10. **ErrorBoundary Missing React.ReactNode Type** (App.tsx)
**Severity:** Low
**Location:** `src/App.tsx` - Line ~340

**Issue:**
```typescript
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
```

This is correct, but the component doesn't implement `getDerivedStateFromError` as a static method properly in all edge cases. Minor style issue:

```typescript
static getDerivedStateFromError(error: Error): { error: Error | null } {
  return { error };
}
```

Should have explicit return type.

---

## Low Priority / Style Issues

### 11. **Inconsistent Spinner Animation** (Home.tsx)
**Severity:** Low
**Location:** Multiple places use `animate-spin`

- Consider extracting into a reusable `<Spinner />` component for consistency

### 12. **Magic Numbers in Tailwind Classes**
**Severity:** Low

Numbers like `w-[68px]`, `max-w-[180px]`, `[cubic-bezier(0.22,1,0.36,1)]` are scattered. Consider moving to `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      transitionTimingFunction: {
        'smooth-curve': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      spacing: {
        'sidebar-collapsed': '68px',
        'sidebar-expanded': '240px',
      },
    }
  }
}
```

---

## Summary Table

| Issue | File | Severity | Type |
|-------|------|----------|------|
| RAF Memory Leak | Home.tsx | **Critical** | Performance |
| Auth Error Handling | auth.tsx | **High** | Reliability |
| Tab Switch Race Condition | App.tsx | **High** | Logic |
| Settings Patch Idempotency | settings.tsx | **Medium** | Performance |
| ResizeObserver Memory | Home.tsx | **Medium** | Performance |
| Roadmap Page Edge Case | Home.tsx | **Medium** | Logic |
| Missing Hex Validation | settings.tsx | **Medium** | Robustness |
| Unused State | Home.tsx | **Low** | Code Quality |
| Alt Text Missing | Home.tsx | **Low** | Accessibility |
| Magic Numbers | Multiple | **Low** | Maintainability |

---

## Recommendations

1. **Immediate:** Fix RAF memory leak and auth error handling
2. **Short-term:** Add error boundaries and loading states for async operations
3. **Medium-term:** Extract reusable components (Spinner, Button variants, etc.)
4. **Ongoing:** Increase test coverage, especially for state management and edge cases
