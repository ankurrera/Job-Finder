# DESIGN DNA — Job-Finder

> ⚠️ This file must be filled in before any UI work begins.
> Agents MUST read this before writing any CSS, layout, or component.

---

## Color System

| Role | Value | Usage |
|:-----|:------|:------|
| Primary | `oklch(??% ?? ???)` | Main CTAs, active states |
| Background | `oklch(??% ?? ???)` | Page background |
| Surface | `oklch(??% ?? ???)` | Card backgrounds |
| Text Primary | `oklch(??% ?? ???)` | Headings, body |
| Text Secondary | `oklch(??% ?? ???)` | Subheadings, labels |
| Accent | `oklch(??% ?? ???)` | Highlights, badges |
| Error | `oklch(??% ?? ???)` | Error states |
| Success | `oklch(??% ?? ???)` | Success states |

**Rule**: Never use raw hex or RGB. All values must be in the OKLCH token system above.

---

## Typography

| Role | Size | Weight | Tracking | Usage |
|:-----|:-----|:-------|:---------|:------|
| h1 | ??px | ??? | ??? | Page titles |
| h2 | ??px | ??? | ??? | Section headings |
| h3 | ??px | ??? | ??? | Card headings |
| body-lg | ??px | ??? | ??? | Primary body |
| body-sm | ??px | ??? | ??? | Secondary body |
| label | ??px | ??? | ??? | Form labels, tags |

Font family: **[Choose font]** — loaded via `next/font/google`.

---

## Spacing Scale (4px base grid)

```
xs: 4px | sm: 8px | md: 12px | base: 16px | lg: 24px | xl: 32px | xxl: 48px
```

---

## Border Radius

| Context | Radius |
|:--------|:-------|
| Buttons | ??px |
| Cards | ??px |
| Inputs | ??px |
| Badges/Tags | ??px |

---

## Interaction & Motion

- **Press feedback**: Scale to `0.97–0.98` on `active` state, `150ms ease-out`
- **State transitions**: Color and border changes animate over `150–180ms ease-out`
- **List removal**: Animate `opacity → 0` and `height → 0` over `200ms` before DOM removal
