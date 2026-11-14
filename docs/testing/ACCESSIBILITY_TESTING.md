# Accessibility Testing Guide

## Overview

This guide provides step-by-step instructions for testing accessibility compliance in the Bundestag Wortschatz Tracker.

---

## Quick Testing Checklist

Before every release, complete this checklist:

- [ ] Keyboard navigation works on all pages
- [ ] Screen reader announces content correctly
- [ ] Color contrast meets WCAG AA standards
- [ ] Text scales to 200% without breaking
- [ ] Focus indicators visible
- [ ] Skip links work
- [ ] All images have alt text
- [ ] Forms have proper labels
- [ ] No automated accessibility errors (axe/Lighthouse)

---

## 1. Keyboard Navigation Testing

### Test All Interactive Elements

**Procedure:**
1. Open the application
2. **Do not use your mouse**
3. Press `Tab` to navigate forward
4. Press `Shift+Tab` to navigate backward
5. Press `Enter` or `Space` to activate buttons/links

**What to Test:**

✅ **Navigation:**
- Tab through navigation links
- Theme toggle button accessible
- Mobile menu button accessible
- Links activate with Enter

✅ **Forms:**
- All inputs focusable
- Tab order logical
- Submit with Enter
- Escape clears/closes

✅ **Modals/Dialogs:**
- Focus trapped inside modal
- Escape key closes modal
- Focus returns after close

✅ **Tables:**
- Can navigate through table cells
- Sortable columns keyboard accessible

✅ **Charts:**
- Chart controls keyboard accessible
- Zoom reset button focusable

**Expected Results:**
- All functionality available via keyboard
- Tab order follows visual order
- Focus indicators clearly visible
- No keyboard traps

---

## 2. Screen Reader Testing

### VoiceOver (macOS)

**Enable VoiceOver:**
```
Command + F5
```

**Basic Controls:**
- `VO + Right Arrow`: Next element
- `VO + Left Arrow`: Previous element
- `VO + Space`: Activate element
- `VO + H`: Next heading
- `VO + Shift + H`: Previous heading

**Test Procedure:**

1. **Navigate with VO + Arrow keys**
   - Verify all content announced
   - Check heading hierarchy
   - Confirm link purposes clear

2. **Use Landmarks**
   - Press `VO + U`: Open rotor
   - Select Landmarks
   - Navigate through nav, main, footer
   - Verify all sections accessible

3. **Test Forms**
   - Navigate to form inputs
   - Verify labels announced
   - Check error messages read
   - Confirm required fields indicated

4. **Test Tables**
   - Navigate table with `VO + arrows`
   - Verify headers announced
   - Check row/column information

**Expected Results:**
- All text content announced
- Interactive elements identified correctly
- Headings provide structure
- Forms clearly labeled
- Tables navigable

### NVDA (Windows)

**Download:** https://www.nvaccess.org/download/

**Basic Controls:**
- `Down Arrow`: Next element
- `Up Arrow`: Previous element
- `H`: Next heading
- `K`: Next link
- `B`: Next button
- `F`: Next form field

**Test Procedure:**
1. Start NVDA
2. Navigate with arrow keys
3. Use shortcut keys (H, K, B, F)
4. Test forms and interactions
5. Verify all announcements clear

---

## 3. Automated Testing

### Option 1: axe DevTools (Recommended)

**Installation:**
1. Install [axe DevTools](https://chrome.google.com/webstore/detail/axe-devtools-web-accessibility/lhdoppojpmngadmnindnejefpokejbdd) Chrome extension
2. Open Chrome DevTools (F12)
3. Go to "axe DevTools" tab

**Testing Procedure:**
1. Navigate to page to test
2. Click "Scan ALL of my page"
3. Review violations
4. Fix all Critical and Serious issues
5. Address Moderate and Minor issues
6. Re-scan until zero violations

**What axe Checks:**
- Color contrast
- Missing alt text
- Form labels
- ARIA usage
- Keyboard accessibility
- Heading hierarchy
- And 90+ other rules

### Option 2: Lighthouse (Built-in Chrome)

**Access:**
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Accessibility"
4. Click "Analyze page load"

**Target Score:** 100

**Testing Procedure:**
1. Run Lighthouse on each page
2. Review all failed audits
3. Fix issues
4. Re-run until 100 score

**Common Issues Flagged:**
- Low color contrast
- Missing ARIA labels
- No alt text
- Form issues
- Heading skip levels

### Option 3: WAVE (Browser Extension)

**Installation:**
Install [WAVE](https://wave.webaim.org/extension/) extension

**Testing Procedure:**
1. Navigate to page
2. Click WAVE icon
3. Review errors (red)
4. Review alerts (yellow)
5. Check contrast issues
6. Fix and re-test

**WAVE Categories:**
- Errors: Must fix
- Contrast Errors: Must fix
- Alerts: Review carefully
- Features: Informational
- Structural Elements: Informational

### Option 4: Pa11y (CLI)

**Installation:**
```bash
npm install -g pa11y pa11y-ci
```

**Test Single Page:**
```bash
pa11y http://localhost:5176
```

**Test Multiple Pages:**
Create `pa11y-ci.json`:
```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000
  },
  "urls": [
    "http://localhost:5176/",
    "http://localhost:5176/redner",
    "http://localhost:5176/parteien",
    "http://localhost:5176/wahlperioden",
    "http://localhost:5176/wort/klimawandel"
  ]
}
```

Run tests:
```bash
pa11y-ci
```

**Add to package.json:**
```json
{
  "scripts": {
    "test:a11y": "pa11y-ci"
  }
}
```

---

## 4. Color Contrast Testing

### Manual Testing

**Tool:** [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

**Procedure:**
1. Identify text color
2. Identify background color
3. Enter into contrast checker
4. Verify ratio meets standards:
   - Normal text: ≥ 4.5:1 (AA)
   - Large text (18pt+): ≥ 3:1 (AA)
   - UI components: ≥ 3:1 (AA)

**What to Test:**
- Body text on background
- Link text on background
- Muted text on background
- Button text on button background
- Focus indicators
- Error messages
- Placeholder text

### Chrome DevTools

**Procedure:**
1. Open DevTools (F12)
2. Inspect element
3. Check "Contrast" section in Styles panel
4. Verify checkmarks (✓) appear

**Fix Low Contrast:**
- Adjust color values
- Use CSS variables that meet standards
- Test in both light and dark mode

---

## 5. Responsive/Zoom Testing

### Test at 200% Zoom

**Procedure:**
1. Open browser
2. Press `Ctrl/Cmd + +` repeatedly to 200%
3. Or: Settings → Zoom → 200%

**What to Test:**
- [ ] All text readable
- [ ] No horizontal scrolling
- [ ] All functionality works
- [ ] Touch targets remain adequate
- [ ] No content overlap

**Expected Results:**
- Content reflows properly
- No loss of functionality
- Text remains readable
- Buttons remain clickable

### Test at 400% Zoom (AAA)

Optional but recommended:
- Same tests as 200%
- More challenging
- Aim for AAA compliance

### Mobile Viewport Testing

**Test at:**
- 320px (iPhone SE)
- 375px (iPhone)
- 768px (iPad)
- 1024px (Desktop)

**Verify:**
- Content adapts
- Touch targets ≥ 44×44px
- Text readable
- No horizontal scroll

---

## 6. Focus Indicator Testing

### Visual Testing

**Procedure:**
1. Tab through page
2. Observe focus indicators
3. Verify visibility

**Requirements:**
- Focus ring visible on all elements
- Contrast ratio ≥ 3:1 against background
- Focus ring not removed (no `outline: none`)
- Custom focus styles meet standards

**Test in Both Themes:**
- Light mode
- Dark mode

### Test Custom Components

**For each custom component:**
1. Tab to component
2. Verify focus visible
3. Check focus style appropriate
4. Test with keyboard activation

---

## 7. Form Testing

### Label Association

**Test:**
1. Click form labels
2. Verify input receives focus
3. Check screen reader announces label

**Verify:**
- All inputs have `<label>` with `htmlFor`
- Or `aria-label` on input
- No placeholder-only labels

### Error Handling

**Test:**
1. Submit form with errors
2. Verify error messages appear
3. Check error messages descriptive
4. Confirm screen reader announces errors

**Requirements:**
- Error messages in text (not just color)
- Errors linked to inputs (`aria-describedby`)
- Error summary at top of form
- Focus moved to first error

### Required Fields

**Verify:**
- Required fields marked visually
- `required` attribute present
- `aria-required="true"` if using ARIA
- Screen reader announces "required"

---

## 8. Image Alternative Text

### Test All Images

**Procedure:**
1. Disable images in browser
2. Or use screen reader
3. Verify alt text appropriate

**Guidelines:**
- Informative images: Descriptive alt
- Decorative images: `alt=""` or `aria-hidden`
- Functional images: Describe function
- Complex images: Detailed description

**Examples:**
```html
<!-- Informative -->
<img src="logo.png" alt="Bundestag Wortschatz Logo" />

<!-- Decorative -->
<img src="divider.png" alt="" aria-hidden="true" />

<!-- Functional -->
<button aria-label="Suchen">
  <img src="search.svg" alt="" />
</button>
```

---

## 9. Heading Structure

### Test Hierarchy

**Tool:** Use screen reader or headings extension

**Verify:**
- Only one `<h1>` per page
- No skipped levels (h1 → h3)
- Headings describe content
- Logical structure

**Example:**
```
h1: Page Title
  h2: Section 1
    h3: Subsection 1.1
    h3: Subsection 1.2
  h2: Section 2
    h3: Subsection 2.1
```

**Test with Screen Reader:**
```
VoiceOver: VO + Command + H
NVDA: H key
```

---

## 10. ARIA Testing

### Common ARIA Attributes

**Verify Correct Usage:**
- `aria-label`: Descriptive labels
- `aria-labelledby`: References label element
- `aria-describedby`: References description
- `aria-hidden`: Hides decorative content
- `role`: Proper ARIA roles
- `aria-live`: For dynamic content

**Test:**
1. Inspect elements with ARIA
2. Verify attributes used correctly
3. Check screen reader announcements
4. Confirm no ARIA errors (axe DevTools)

**Common Mistakes:**
- Using `aria-label` on non-interactive elements
- Wrong ARIA roles
- Conflicting native HTML and ARIA
- Missing required ARIA properties

---

## Testing Workflow

### Before Each Commit

```bash
# 1. Manual keyboard test (2 minutes)
# Tab through your changes

# 2. Run automated tests
npm run test:a11y

# 3. Check with axe DevTools
# Scan the page

# 4. Verify no regressions
```

### Before Each Release

```bash
# 1. Full keyboard navigation test (10 minutes)
# Test all pages

# 2. Screen reader test (15 minutes)
# VoiceOver or NVDA

# 3. Automated testing (5 minutes)
npm run test:a11y
npm run lighthouse

# 4. Color contrast check (5 minutes)
# Test all color combinations

# 5. Zoom testing (5 minutes)
# Test at 200% zoom

# Total: ~40 minutes
```

### Quarterly Audit

Every 3 months:
1. Full WCAG 2.1 audit
2. Test with multiple screen readers
3. Real user testing (if possible)
4. Update documentation
5. Fix any new issues

---

## Issue Tracking

### Priority Levels

**P0: Blocker**
- Keyboard trap
- Complete loss of functionality
- Unable to access critical content

**P1: Critical**
- WCAG A violations
- Contrast below 3:1
- Missing alt text on important images
- Unlabeled form inputs

**P2: Important**
- WCAG AA violations
- Contrast below 4.5:1
- Focus indicators unclear
- Poor heading structure

**P3: Minor**
- WCAG AAA recommendations
- Enhancement opportunities
- Best practice improvements

### Bug Report Template

```markdown
## Accessibility Issue

**Type:** [Keyboard / Screen Reader / Contrast / ARIA / Other]
**Severity:** [P0 / P1 / P2 / P3]
**WCAG Criterion:** [e.g., 1.4.3 Contrast Minimum]
**Page/Component:** [URL or component name]

### Description
[What is the issue?]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Observe issue]

### Expected Behavior
[What should happen?]

### Actual Behavior
[What actually happens?]

### Screenshots/Video
[If applicable]

### Suggested Fix
[How to fix this?]
```

---

## Resources

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Pa11y](https://pa11y.org/)

### Screen Readers
- [VoiceOver (macOS)](https://www.apple.com/accessibility/voiceover/)
- [NVDA (Windows)](https://www.nvaccess.org/)
- [JAWS (Windows)](https://www.freedomscientific.com/products/software/jaws/)

### Color Contrast
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

### Learning Resources
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Articles](https://webaim.org/articles/)
- [A11y Project](https://www.a11yproject.com/)

---

**Last Updated:** 2026-02-14
**Next Review:** 2026-05-14
