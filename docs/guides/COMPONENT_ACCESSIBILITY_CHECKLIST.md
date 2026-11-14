# Component Accessibility Checklist

Use this checklist when creating or modifying components to ensure WCAG 2.1 AA compliance.

---

## Pre-Development

Before writing code:

- [ ] Review WCAG guidelines for this component type
- [ ] Check if shadcn/ui has an accessible version
- [ ] Understand keyboard interaction patterns
- [ ] Plan ARIA attributes needed

---

## General Requirements

Every component must meet these requirements:

### Semantic HTML
- [ ] Use correct HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- [ ] No `<div>` buttons or `<span>` links
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Use `<label>` for form inputs

### Keyboard Accessibility
- [ ] All interactive elements keyboard accessible
- [ ] Tab order is logical
- [ ] Enter/Space activates buttons
- [ ] Escape closes dialogs/menus
- [ ] No keyboard traps
- [ ] Custom keyboard shortcuts documented

### Focus Management
- [ ] Visible focus indicators on all elements
- [ ] Focus ring has 3:1 contrast ratio
- [ ] Focus not removed with `outline: none` unless replaced
- [ ] Focus trapped in modals
- [ ] Focus restored after modal close

### Color & Contrast
- [ ] Text contrast ≥ 4.5:1 (normal) or ≥ 3:1 (large 18pt+)
- [ ] UI component contrast ≥ 3:1
- [ ] Information not conveyed by color alone
- [ ] Works in both light and dark mode

### Text Alternatives
- [ ] All images have `alt` text
- [ ] Icon buttons have `aria-label`
- [ ] Decorative images have `alt=""` or `aria-hidden="true"`
- [ ] Charts have text alternative (table or description)

### ARIA (When Needed)
- [ ] ARIA roles correct and necessary
- [ ] `aria-label` on unlabeled elements
- [ ] `aria-labelledby` references existing text
- [ ] `aria-describedby` for additional info
- [ ] `aria-live` for dynamic content
- [ ] No conflicting HTML and ARIA semantics

---

## Component-Specific Checklists

### Button Component

```jsx
// Example: Accessible button
<Button
  onClick={handleClick}
  disabled={isLoading}
  aria-label="Submit form"  // If text not descriptive
>
  {isLoading ? 'Loading...' : 'Submit'}
</Button>
```

- [ ] Uses `<button>` element
- [ ] Has visible label or `aria-label`
- [ ] `disabled` state indicated
- [ ] Loading state announced to screen readers
- [ ] Keyboard accessible (Enter/Space)
- [ ] Focus visible
- [ ] Adequate size (min 44×44px for touch)

### Icon Button

```jsx
// Example: Accessible icon button
<Button
  variant="ghost"
  size="icon"
  onClick={toggleTheme}
  aria-label="Toggle dark mode"
>
  <Moon className="h-5 w-5" />
  <span className="sr-only">Toggle dark mode</span>
</Button>
```

- [ ] Has `aria-label` describing action
- [ ] Or has `.sr-only` text
- [ ] Icon does not have title/alt
- [ ] Button has minimum 44×44px touch target

### Link Component

```jsx
// Example: Accessible link
<Link
  to="/about"
  aria-label="Learn more about the project"  // If "click here" text
>
  About the Project
</Link>
```

- [ ] Uses `<a>` or React Router `<Link>`
- [ ] Link text describes destination
- [ ] Avoid "click here" or "learn more" without context
- [ ] External links indicate they open new window
- [ ] Underline or clear visual distinction
- [ ] Visited state visible

### Form Input

```jsx
// Example: Accessible input
<div>
  <Label htmlFor="email">Email Address</Label>
  <Input
    id="email"
    type="email"
    required
    aria-required="true"
    aria-describedby="email-error"
  />
  {error && (
    <span id="email-error" role="alert">
      {error}
    </span>
  )}
</div>
```

- [ ] Has associated `<label>` with `htmlFor`
- [ ] Or has `aria-label`
- [ ] Placeholder not sole label
- [ ] Required fields marked (`required` + `aria-required`)
- [ ] Error messages linked (`aria-describedby`)
- [ ] Error has `role="alert"` for screen readers
- [ ] Autocomplete attribute where appropriate

### Select Dropdown

```jsx
// Example: Accessible select
<div>
  <Label htmlFor="sort">Sort by</Label>
  <Select value={sort} onValueChange={setSort}>
    <SelectTrigger id="sort" aria-label="Sort options">
      <SelectValue placeholder="Select sort order" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="date">Date</SelectItem>
      <SelectItem value="name">Name</SelectItem>
    </SelectContent>
  </Select>
</div>
```

- [ ] Has `<label>` or `aria-label`
- [ ] Keyboard navigable (arrow keys, Enter, Escape)
- [ ] Selected value announced
- [ ] Options readable by screen reader
- [ ] Can close with Escape

### Modal/Dialog

```jsx
// Example: Accessible modal
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent aria-labelledby="dialog-title">
    <DialogHeader>
      <DialogTitle id="dialog-title">Confirm Action</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

- [ ] Has `role="dialog"` or `role="alertdialog"`
- [ ] Has `aria-modal="true"`
- [ ] Title referenced with `aria-labelledby`
- [ ] Description referenced with `aria-describedby`
- [ ] Focus trapped inside dialog
- [ ] Escape key closes dialog
- [ ] Focus returned to trigger after close
- [ ] Background content inert (not accessible)

### Data Table

```jsx
// Example: Accessible table
<Table>
  <caption className="sr-only">
    List of speakers and their statistics
  </caption>
  <TableHeader>
    <TableRow>
      <TableHead scope="col">Name</TableHead>
      <TableHead scope="col">Party</TableHead>
      <TableHead scope="col">Words</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.party}</TableCell>
        <TableCell>{item.words}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

- [ ] Has `<caption>` (visible or `.sr-only`)
- [ ] Uses `<thead>`, `<tbody>`, `<tfoot>` structure
- [ ] Column headers use `<th scope="col">`
- [ ] Row headers use `<th scope="row">` if applicable
- [ ] Complex tables have `id` and `headers` attributes
- [ ] Sortable columns keyboard accessible

### Navigation Menu

```jsx
// Example: Accessible navigation
<nav aria-label="Main navigation">
  <ul role="list">
    <li>
      <Link to="/">Home</Link>
    </li>
    <li>
      <Link to="/about">About</Link>
    </li>
  </ul>
</nav>
```

- [ ] Uses `<nav>` element
- [ ] Has `aria-label` to distinguish from other navs
- [ ] Current page indicated (aria-current="page")
- [ ] Keyboard navigable
- [ ] Skip link before navigation

### Tabs Component

```jsx
// Example: Accessible tabs
<Tabs defaultValue="tab1">
  <TabsList aria-label="Section tabs">
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

- [ ] Tab list has `role="tablist"`
- [ ] Tabs have `role="tab"`
- [ ] Tab panels have `role="tabpanel"`
- [ ] Selected tab has `aria-selected="true"`
- [ ] Arrow keys switch between tabs
- [ ] Tab key moves focus to panel content

### Accordion

```jsx
// Example: Accessible accordion
<Accordion type="single" collapsible>
  <AccordionItem value="item1">
    <AccordionTrigger>
      Question 1
    </AccordionTrigger>
    <AccordionContent>
      Answer 1
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

- [ ] Trigger has `aria-expanded` (true/false)
- [ ] Trigger has `aria-controls` referencing panel ID
- [ ] Panel has unique ID
- [ ] Enter/Space toggles expansion
- [ ] Keyboard navigable

### Toast/Alert

```jsx
// Example: Accessible toast
<Toast>
  <ToastTitle>Success</ToastTitle>
  <ToastDescription>
    Your changes have been saved.
  </ToastDescription>
</Toast>
```

- [ ] Has `role="status"` or `role="alert"`
- [ ] `role="alert"` for important messages (interrupts)
- [ ] `role="status"` for non-critical updates
- [ ] Content announced by screen reader
- [ ] Dismissible with keyboard (if interactive)
- [ ] Adequate display time

### Card Component

```jsx
// Example: Accessible card
<Card>
  <CardHeader>
    <CardTitle>
      <Link to="/details">Card Title</Link>
    </CardTitle>
    <CardDescription>
      Brief description of the card content
    </CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

- [ ] Heading hierarchy logical
- [ ] If clickable, whole card is link
- [ ] Or primary action clearly identified
- [ ] No nested links
- [ ] Content readable and structured

### Chart Component

```jsx
// Example: Accessible chart
<div>
  <canvas
    aria-label="Line chart showing word frequency from 1949 to 2026"
    role="img"
  />
  <details className="sr-only">
    <summary>Data table</summary>
    <table>
      {/* Table with chart data */}
    </table>
  </details>
</div>
```

- [ ] Canvas has `role="img"`
- [ ] Canvas has descriptive `aria-label`
- [ ] Data table alternative provided
- [ ] Or `aria-describedby` with text description
- [ ] Interactive controls keyboard accessible
- [ ] Tooltips keyboard accessible

---

## Testing Checklist

After implementing component:

### Manual Testing
- [ ] Tab through with keyboard only
- [ ] Test with VoiceOver/NVDA
- [ ] Verify at 200% zoom
- [ ] Test in both light and dark mode
- [ ] Check on mobile (if applicable)

### Automated Testing
- [ ] Run axe DevTools (zero violations)
- [ ] Run Lighthouse (100 accessibility score)
- [ ] Check color contrast (WebAIM)
- [ ] Validate HTML (W3C Validator)

### Code Review
- [ ] Semantic HTML used
- [ ] ARIA attributes correct
- [ ] Focus management proper
- [ ] Error handling accessible
- [ ] Documentation updated

---

## Common Mistakes to Avoid

### ❌ Don't
```jsx
// Non-semantic
<div onClick={handleClick}>Click me</div>

// No label
<button><X /></button>

// Color-only error
<input className="border-red-500" />

// Removed focus
.button:focus { outline: none; }

// Placeholder as label
<input placeholder="Email" />

// Skipped heading
<h1>Title</h1>
<h3>Subsection</h3>
```

### ✅ Do
```jsx
// Semantic
<button onClick={handleClick}>Click me</button>

// With label
<button aria-label="Close"><X /></button>

// Text + color for error
<input aria-invalid="true" aria-describedby="error" />
<span id="error" role="alert">Invalid email</span>

// Custom focus style
.button:focus-visible {
  outline: 2px solid hsl(var(--ring));
}

// Proper label
<label htmlFor="email">Email</label>
<input id="email" placeholder="you@example.com" />

// Logical heading hierarchy
<h1>Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [shadcn/ui Components](https://ui.shadcn.com/) (already accessible)
- [WebAIM Articles](https://webaim.org/articles/)

---

**Template Version:** 1.0
**Last Updated:** 2026-02-14

Use this checklist for every new component to maintain WCAG 2.1 AA compliance!
