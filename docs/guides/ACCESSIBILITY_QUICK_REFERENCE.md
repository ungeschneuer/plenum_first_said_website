# Accessibility Quick Reference

**For AI Assistants & Developers: This project is WCAG 2.1 AA compliant. Maintain this standard.**

## 30-Second Checklist

When modifying frontend components:

1. ✅ **Keyboard navigation** - All interactive elements work with Tab, Enter, Space
2. ✅ **ARIA labels** - Buttons, links, inputs have descriptive `aria-label`
3. ✅ **Icons hidden** - Decorative icons: `aria-hidden="true"`
4. ✅ **Tables captioned** - `<caption className="sr-only">Description</caption>`
5. ✅ **External links** - Indicate new tab: `aria-label="Text (öffnet in neuem Tab)"`
6. ✅ **Errors accessible** - `<Alert role="alert">`
7. ✅ **Loading announced** - `aria-live="polite"` or `aria-busy={true}`

## Essential Patterns

### Pattern 1: Clickable Card
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
  aria-label="Full description with key info"
>
```

### Pattern 2: Decorative Icon
```jsx
<Icon className="h-4 w-4" aria-hidden="true" />
```

### Pattern 3: Data Table
```jsx
<Table>
  <caption className="sr-only">What this table shows</caption>
  <TableHeader>...</TableHeader>
</Table>
```

### Pattern 4: External Link
```jsx
<a
  href={url}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Link text (öffnet in neuem Tab)"
>
  Text
  <ExternalLink className="h-4 w-4" aria-hidden="true" />
</a>
```

### Pattern 5: Icon Button
```jsx
<Button onClick={action} aria-label="Descriptive action">
  <Icon className="h-4 w-4" aria-hidden="true" />
  Text
</Button>
```

## Reference Components

Copy patterns from these compliant components:
- `SearchPage.jsx` - Clickable cards, loading states
- `WordTimeline.jsx` - Tables, charts, external links
- `SpeakerList.jsx` - Pagination, keyboard cards
- `PartyList.jsx` - Stats cards with icons
- `WahlperiodeDetail.jsx` - Complex multi-section page

## Testing (Before Commit)

```bash
# 1. Keyboard test (no mouse!)
# Tab through your changes, press Enter/Space on interactive elements

# 2. Build test
npm run build

# 3. Visual test
# Check focus indicators visible in light & dark mode
```

## Full Documentation

- Component Checklist: `/docs/guides/COMPONENT_ACCESSIBILITY_CHECKLIST.md`
- Complete Guide: `/docs/implementation/ACCESSIBILITY_COMPLETE.md`
- WCAG Compliance: `/docs/guides/ACCESSIBILITY_WCAG_COMPLIANCE.md`

---

**Status:** WCAG 2.1 AA Compliant ✅
**Updated:** 2026-02-14
