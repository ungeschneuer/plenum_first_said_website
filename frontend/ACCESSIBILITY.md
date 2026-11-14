# ⚠️ ACCESSIBILITY REQUIREMENTS - READ BEFORE CODING

This frontend is **WCAG 2.1 AA compliant**. All changes MUST maintain this standard.

## Quick Compliance Checklist

Before writing any component code, ensure:

- [ ] **Keyboard navigation works** - Tab, Enter, Space activate all interactive elements
- [ ] **All icons marked properly** - Decorative icons get `aria-hidden="true"`
- [ ] **Interactive elements labeled** - Buttons, links, inputs have descriptive labels
- [ ] **Tables have captions** - `<caption className="sr-only">Descriptive text</caption>`
- [ ] **External links indicate new tab** - `aria-label="Text (öffnet in neuem Tab)"`
- [ ] **Error messages accessible** - `<Alert role="alert">`
- [ ] **Loading states announced** - `aria-live="polite"` or `aria-busy={true}`

## Copy-Paste Patterns

### Clickable Card (navigate on click)
```jsx
<Card
  onClick={() => navigate(path)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(path);
    }
  }}
  tabIndex={0}
  role="button"
  aria-label="Complete description including all visible stats"
>
  <CardContent>
    <Icon className="h-4 w-4" aria-hidden="true" />
    <span>Visible text</span>
  </CardContent>
</Card>
```

### Icon Button
```jsx
<Button onClick={handleClick} aria-label="Descriptive action">
  <Icon className="h-4 w-4" aria-hidden="true" />
  Button Text
</Button>
```

### Data Table
```jsx
<Table>
  <caption className="sr-only">
    Descriptive caption explaining what data is shown
  </caption>
  <TableHeader>
    <TableRow>
      <TableHead>Column</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>...</TableBody>
</Table>
```

### External Link
```jsx
<Button variant="outline" asChild>
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Link text (öffnet in neuem Tab)"
  >
    Link Text
    <ExternalLink className="h-3 w-3 ml-2" aria-hidden="true" />
  </a>
</Button>
```

### Pagination
```jsx
<nav aria-label="Seitennavigation">
  <Button
    onClick={() => setPage(page)}
    aria-label={`Gehe zu Seite ${page}`}
    aria-current={page === currentPage ? 'page' : undefined}
  >
    {page}
  </Button>
</nav>
```

### Form Input
```jsx
<div className="space-y-2">
  <Label htmlFor="input-id">Label Text</Label>
  <Input
    id="input-id"
    type="text"
    aria-label="Descriptive label"
  />
</div>
```

### Loading State
```jsx
{loading && (
  <div aria-live="polite" aria-busy="true">
    <Skeleton className="h-8" />
    <span className="sr-only">Wird geladen...</span>
  </div>
)}
```

### Error Alert
```jsx
<Alert variant="destructive" role="alert">
  <AlertDescription>{error}</AlertDescription>
</Alert>
```

## Testing Before Commit

1. **Keyboard test** (2 minutes):
   - Unplug your mouse
   - Tab through your changes
   - Press Enter/Space on buttons/links
   - Verify all functionality works

2. **Build test**:
   ```bash
   npm run build
   ```
   No errors should appear

3. **Visual test**:
   - Check focus indicators are visible
   - Test in both light and dark mode

## Reference Examples

Look at these files for correct patterns:
- `src/components/SearchPage.jsx` - Clickable cards, loading states
- `src/components/WordTimeline.jsx` - Tables, external links
- `src/components/SpeakerList.jsx` - Pagination, sort controls
- `src/components/PartyList.jsx` - Clickable cards with stats
- `src/components/WahlperiodeList.jsx` - Complex cards

## Full Documentation

- **Component Checklist:** `/docs/guides/COMPONENT_ACCESSIBILITY_CHECKLIST.md`
- **Complete Guide:** `/docs/implementation/ACCESSIBILITY_COMPLETE.md`
- **Testing Guide:** `/docs/testing/ACCESSIBILITY_TESTING.md`
- **WCAG Compliance:** `/docs/guides/ACCESSIBILITY_WCAG_COMPLIANCE.md`

## Common Mistakes to Avoid

❌ **DON'T:**
```jsx
// Missing keyboard support
<div onClick={handleClick}>Click me</div>

// No aria-label on icon button
<button><X /></button>

// Decorative icon not hidden
<Calendar className="h-4 w-4" />

// Missing table caption
<Table><TableHeader>...</TableHeader></Table>

// External link without new-tab indicator
<a href={url} target="_blank">Link</a>
```

✅ **DO:**
```jsx
// Proper button with keyboard support
<Card
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  tabIndex={0}
  role="button"
  aria-label="Descriptive label"
>

// Icon button with label
<button aria-label="Close">
  <X className="h-4 w-4" aria-hidden="true" />
</button>

// Decorative icon hidden from screen readers
<Calendar className="h-4 w-4" aria-hidden="true" />

// Table with caption
<Table>
  <caption className="sr-only">Data description</caption>
  ...
</Table>

// External link with indicator
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Link (öffnet in neuem Tab)"
>
```

## Questions?

If unsure about accessibility requirements:
1. Check existing components for similar patterns
2. Review the checklist: `/docs/guides/COMPONENT_ACCESSIBILITY_CHECKLIST.md`
3. Test with keyboard only (no mouse)

**Remember:** Accessibility is not optional. All user-facing components must be accessible.

---

**Compliance Status:** ✅ WCAG 2.1 AA Compliant (as of 2026-02-14)
**Last Updated:** 2026-02-14
