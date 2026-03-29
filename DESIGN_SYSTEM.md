# Glass Dark — Design System

> מערכת עיצוב מינימלית כהה עם אפקט glassmorphism.
> מיועדת לפרויקטים עם Next.js / React + Tailwind CSS v4 + עברית RTL.
> תשים את הקובץ הזה בשורש הפרויקט כ-`DESIGN_SYSTEM.md` ותפנה אליו ב-`CLAUDE.md`.

---

## 1. פילוסופיה

שלושה עקרונות:

1. **שקיפות, לא מוצקות** — כל משטח הוא שקוף-למחצה עם blur. אף פעם solid black.
2. **שקט, לא רעש** — צבע אקסנט אחד בלבד. מונוכרומטי ברוב הממשק. ריווח נדיב.
3. **פונקציה לפני קישוט** — לא glow, לא particles, לא נאון. רק מה שמשרת את המשתמש.

---

## 2. Design Tokens — CSS Custom Properties

העתק לתוך `globals.css` (או קובץ ה-CSS הראשי):

```css
:root {
  /* ── Page ── */
  --page-bg: linear-gradient(135deg, #0a0e17 0%, #131820 50%, #0d1117 100%);

  /* ── Glass surfaces ── */
  --glass-bg:            rgba(20, 25, 35, 0.75);
  --glass-bg-hover:      rgba(20, 25, 35, 0.85);
  --glass-bg-elevated:   rgba(20, 25, 35, 0.88);
  --glass-border:        rgba(255, 255, 255, 0.08);
  --glass-border-hover:  rgba(255, 255, 255, 0.15);
  --glass-border-active: rgba(255, 255, 255, 0.22);
  --glass-blur:          blur(20px);
  --glass-blur-strong:   blur(32px);

  /* ── Card surfaces (inside panels) ── */
  --card-bg:             rgba(255, 255, 255, 0.04);
  --card-bg-hover:       rgba(255, 255, 255, 0.08);
  --card-bg-active:      rgba(255, 255, 255, 0.12);

  /* ── Text hierarchy ── */
  --text-primary:    rgba(255, 255, 255, 0.90);
  --text-secondary:  rgba(255, 255, 255, 0.55);
  --text-muted:      rgba(255, 255, 255, 0.35);
  --text-disabled:   rgba(255, 255, 255, 0.20);

  /* ── Accent (one color only — blue) ── */
  --accent:          #2563eb;
  --accent-hover:    #1d4ed8;
  --accent-subtle:   rgba(37, 99, 235, 0.15);
  --accent-ring:     rgba(37, 99, 235, 0.30);

  /* ── Semantic ── */
  --danger:          #ef4444;
  --danger-hover:    #dc2626;
  --success:         #22c55e;
  --warning:         #f59e0b;

  /* ── Radii ── */
  --radius-panel:    16px;   /* containers ראשיים */
  --radius-card:     12px;   /* כרטיסים פנימיים */
  --radius-input:    12px;   /* שדות input */
  --radius-button:   9999px; /* pill buttons */
  --radius-icon-btn: 10px;   /* כפתורי אייקון */

  /* ── Spacing scale (px) ── */
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  12px;
  --space-lg:  16px;
  --space-xl:  24px;
  --space-2xl: 32px;
  --space-3xl: 48px;

  /* ── Transitions ── */
  --transition-fast:   all 0.15s ease;
  --transition-normal: all 0.2s ease;
  --transition-slow:   all 0.3s ease;

  /* ── Z-index scale ── */
  --z-base:    1;
  --z-sticky:  10;
  --z-overlay: 20;
  --z-modal:   30;
  --z-toast:   40;
}
```

---

## 3. Typography

### פונט

- **פונט ראשי**: `Heebo` (Google Fonts, self-hosted עם `next/font`)
- **פונט קוד**: `Fira Code` או `JetBrains Mono`
- **Fallback stack**: `'Heebo', 'Assistant', 'Noto Sans Hebrew', sans-serif`

### סולם טיפוגרפי

| Role          | Size       | Weight   | Line-height | Color              | Letter-spacing |
|---------------|------------|----------|-------------|--------------------|----------------|
| Display       | `text-3xl` | 600      | 1.3         | `--text-primary`   | `-0.02em`      |
| Heading 1     | `text-2xl` | 600      | 1.35        | `--text-primary`   | `-0.01em`      |
| Heading 2     | `text-xl`  | 600      | 1.4         | `--text-primary`   | `normal`       |
| Heading 3     | `text-lg`  | 600      | 1.4         | `--text-primary`   | `normal`       |
| Body          | `text-base`| 400      | 1.7         | `--text-primary`   | `normal`       |
| Body small    | `text-sm`  | 400      | 1.6         | `--text-secondary` | `normal`       |
| Caption/Label | `text-xs`  | 500      | 1.5         | `--text-muted`     | `0.05em`       |
| Overline      | `text-xs`  | 500      | 1.5         | `--text-muted`     | `0.08em`       |

### כללים

- **כותרות**: `font-semibold` (600). לעולם לא `font-bold` (700) — זה כבד מדי.
- **גוף טקסט**: `font-normal` (400). לעולם לא `font-light` (300) — לא קריא.
- **Labels/Overlines**: `uppercase tracking-wider` עם `--text-muted`.
- **Line-height בעברית**: גבוה מ-defaults — `1.7` לגוף, `1.4` לכותרות.
- **לא צבע על טקסט** — טקסט תמיד בגווני לבן/אפור. אקסנט רק על כפתורים ולינקים.

---

## 4. Surfaces & Layers

### שכבות (מלמטה למעלה)

```
Page background     ← gradient כהה (--page-bg)
  └── Glass Panel   ← rgba(20,25,35,0.75) + blur(20px) + border white/8%
        └── Card    ← rgba(255,255,255,0.04) + border white/8%
              └── Content (text, inputs, buttons)
```

### Page Background

```css
body {
  background: var(--page-bg);
  min-height: 100vh;
}
```

לעולם לא solid color. תמיד gradient עדין או תמונת רקע עם blur.

### Glass Panel (containers ראשיים)

```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-panel);
}
```

**שימוש**: sidebars, modals, headers, main content areas, dialogs.

### Card (אלמנטים פנימיים)

```css
.glass-card {
  background: var(--card-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-card);
  transition: var(--transition-normal);
}
.glass-card:hover {
  background: var(--card-bg-hover);
  border-color: var(--glass-border-hover);
}
.glass-card.active,
.glass-card[data-active="true"] {
  background: var(--card-bg-active);
  border-color: var(--accent);
}
```

**שימוש**: list items, post cards, note cards, settings rows.

### Elevated Panel (floating elements)

```css
.glass-elevated {
  background: var(--glass-bg-elevated);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-panel);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

**שימוש**: dropdowns, tooltips, floating toolbars.

---

## 5. Components

### 5.1 Buttons

#### Primary (CTA)

```css
.btn-primary {
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-button);
  padding: 8px 20px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: var(--transition-fast);
  cursor: pointer;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
```

#### Ghost / Outline

```css
.btn-ghost {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-button);
  padding: 8px 20px;
  font-weight: 500;
  font-size: 0.875rem;
  transition: var(--transition-fast);
  cursor: pointer;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}
```

#### Icon Button

```css
.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-icon-btn);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  transition: var(--transition-fast);
  cursor: pointer;
}
.btn-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}
```

#### Danger

```css
.btn-danger {
  background: var(--danger);
  color: white;
  border: none;
  border-radius: var(--radius-button);
  padding: 8px 20px;
  font-weight: 500;
  transition: var(--transition-fast);
}
.btn-danger:hover { background: var(--danger-hover); }
```

### 5.2 Inputs

```css
.glass-input {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-input);
  padding: 12px 16px;
  color: var(--text-primary);
  font-size: 1rem;
  transition: var(--transition-normal);
  outline: none;
}
.glass-input::placeholder {
  color: var(--text-muted);
}
.glass-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
```

### 5.3 Textarea

```css
.glass-textarea {
  /* same as glass-input, plus: */
  resize: vertical;
  min-height: 120px;
  line-height: 1.7;
}
```

### 5.4 Dividers

```css
.divider {
  border: none;
  border-top: 1px solid var(--glass-border);
  margin: var(--space-xl) 0;
}
```

### 5.5 Blockquotes

```css
.blockquote {
  border-inline-start: 3px solid rgba(255, 255, 255, 0.3);
  padding-inline-start: var(--space-lg);
  color: var(--text-primary);
  font-style: normal; /* לא italic */
  margin: var(--space-lg) 0;
}
```

### 5.6 Badges / Chips

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-button);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  transition: var(--transition-fast);
}
.chip:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}
.chip.active {
  background: var(--accent-subtle);
  border-color: var(--accent);
  color: white;
}
```

### 5.7 Pill Header (Navigation Bar)

```css
.pill-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 768px;
  margin: 0 auto;
  padding: 8px 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-button);
  position: sticky;
  top: var(--space-lg);
  z-index: var(--z-sticky);
}
```

### 5.8 Skeleton Loader

```css
.skeleton {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 5.9 Dialog / Modal

```css
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  background: var(--glass-bg-elevated);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-panel);
  padding: var(--space-xl);
  max-width: 480px;
  width: 90%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}
```

### 5.10 Toast / Notification

```css
.toast {
  position: fixed;
  bottom: var(--space-xl);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  padding: 10px 20px;
  background: var(--glass-bg-elevated);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-button);
  color: var(--text-primary);
  font-size: 0.875rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
```

---

## 6. Layout Patterns

### 6.1 Split View (Sidebar + Main)

```
┌─── Sidebar (w-80) ──┐ ┌─── Main (flex-1) ──────────────┐
│  glass-panel          │ │  glass-panel                    │
│  overflow-y-auto      │ │                                 │
│  gap-3 between cards  │ │  header → content → footer      │
└───────────────────────┘ └─────────────────────────────────┘
```

```html
<div class="flex gap-4 h-screen p-4">
  <aside class="glass-panel w-80 p-4 overflow-y-auto flex flex-col gap-3">
    <!-- cards -->
  </aside>
  <main class="glass-panel flex-1 p-6 overflow-y-auto">
    <!-- content -->
  </main>
</div>
```

**Responsive**: ב-mobile (`< md`) ה-sidebar הופך לרשימה אנכית מלאה, והMain מוסתר עד שנבחר פריט.

### 6.2 Centered Panel

```html
<div class="flex items-center justify-center min-h-screen p-4">
  <div class="glass-panel max-w-2xl w-full p-8">
    <!-- content -->
  </div>
</div>
```

### 6.3 Header + Content + Footer

```html
<div class="min-h-screen flex flex-col p-4 gap-4">
  <header class="pill-header">...</header>
  <main class="glass-panel flex-1 p-6">...</main>
  <footer class="text-center text-xs" style="color: var(--text-muted)">...</footer>
</div>
```

---

## 7. RTL / Hebrew Rules

### חובה:

- `<html lang="he" dir="rtl">` על ה-root element.
- השתמש ב-**logical properties** של Tailwind בלבד:
  - `ms-` / `me-` במקום `ml-` / `mr-`
  - `ps-` / `pe-` במקום `pl-` / `pr-`
  - `border-s` / `border-e` במקום `border-l` / `border-r`
  - `text-start` / `text-end` במקום `text-left` / `text-right`
  - `start-0` / `end-0` במקום `left-0` / `right-0`
  - `rounded-s-` / `rounded-e-` במקום `rounded-l-` / `rounded-r-`
- **Blockquote border**: `border-inline-start` (= border-right ב-RTL).
- **Icons directional** (חצים, chevrons): `rtl:scale-x-[-1]` או `rtl:rotate-180`.
- **line-height גבוה**: 1.7 לפחות לגוף טקסט עברי.
- **פונט**: Heebo כברירת מחדל. `font-display: swap` למניעת FOIT.

---

## 8. Animations

### מותר:

```css
/* Hover transitions — on cards, buttons, links */
transition: var(--transition-normal);

/* Subtle entrance — for panels first appearing */
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-enter {
  animation: fade-in-up 0.3s ease forwards;
}

/* Skeleton pulse — for loading states */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
```

### אסור:

- **framer-motion** — CSS transitions בלבד.
- **float/bounce/glow** — לא אנימציות מתמשכות.
- **page transitions** — לא צריך.
- **parallax / scroll-triggered** — מוגזם.

---

## 9. Icons

- **ספרייה**: `lucide-react` (outline style בלבד).
- **גודל ברירת מחדל**: `size={18}` (תוך כפתורים), `size={20}` (standalone).
- **צבע**: `currentColor` — ירשו מה-parent (`--text-secondary` בדר"כ).
- **לעולם לא filled icons** — רק stroke/outline.
- **Stroke width**: 1.5 (default של lucide).

---

## 10. Do's and Don'ts

### ✅ Do

- Glass panels עם `backdrop-filter: blur(20px)`
- גבולות דקים: `rgba(255, 255, 255, 0.08)`
- ריווח נדיב (p-5 עד p-8)
- טקסט בגווני `rgba(255,255,255, 0.35–0.90)`
- כפתורי pill (`rounded-full`)
- אקסנט כחול אחד בלבד (#2563eb)
- Hover = הגברת שקיפות רקע + שינוי border
- CSS transitions בלבד
- RTL עם logical properties

### ❌ Don't

- רקע solid שחור (`#000`, `#0c0f14`)
- `box-shadow` כבדים
- גרדיינטים צבעוניים על cards
- badges/tags צבעוניים רבים
- glow / neon / text-shadow
- framer-motion
- `font-bold` (700) — רק `font-semibold` (600) מקסימום
- לבן מלא (`#fff`) על טקסט — תמיד `rgba` עם שקיפות
- יותר מצבע אקסנט אחד

---

## 11. Tailwind v4 Integration

### `@theme` block (בתוך globals.css):

```css
@import "tailwindcss";

@theme inline {
  /* Map design tokens to Tailwind */
  --color-glass-bg:          rgba(20, 25, 35, 0.75);
  --color-glass-border:      rgba(255, 255, 255, 0.08);
  --color-card-bg:           rgba(255, 255, 255, 0.04);
  --color-text-primary:      rgba(255, 255, 255, 0.90);
  --color-text-secondary:    rgba(255, 255, 255, 0.55);
  --color-text-muted:        rgba(255, 255, 255, 0.35);
  --color-accent:            #2563eb;
  --color-accent-hover:      #1d4ed8;
  --color-danger:            #ef4444;

  --font-sans: 'Heebo', 'Assistant', 'Noto Sans Hebrew', sans-serif;
  --font-mono: 'Fira Code', 'JetBrains Mono', monospace;

  --leading-tight:   1.4;
  --leading-normal:  1.7;
  --leading-relaxed: 1.9;
}
```

**שימוש ב-Tailwind classes:**

```html
<div class="bg-glass-bg text-text-primary border border-glass-border rounded-2xl p-6">
  <h1 class="text-2xl font-semibold leading-tight">כותרת</h1>
  <p class="text-text-secondary text-sm mt-2">תיאור</p>
</div>
```

---

## 12. File Structure (recommended)

```
src/
├── app/
│   ├── globals.css          ← design tokens + utility classes
│   └── layout.tsx           ← <html lang="he" dir="rtl">, font, page-bg
├── components/
│   ├── ui/
│   │   ├── GlassPanel.tsx   ← reusable glass container
│   │   ├── GlassCard.tsx    ← interactive card
│   │   ├── Button.tsx       ← primary / ghost / icon / danger variants
│   │   ├── Input.tsx        ← glass input
│   │   ├── Dialog.tsx       ← modal with overlay
│   │   ├── Chip.tsx         ← filter/tag chips
│   │   ├── Skeleton.tsx     ← loading placeholder
│   │   ├── Divider.tsx      ← thin line separator
│   │   ├── PillHeader.tsx   ← floating pill navigation
│   │   └── Toast.tsx        ← notification
│   └── ...
├── DESIGN_SYSTEM.md         ← this file
└── CLAUDE.md                ← project instructions (reference this file)
```

---

## 13. Quick-Start for Claude Code

שים ב-`CLAUDE.md` שלך:

```markdown
## Design System

קרא את `DESIGN_SYSTEM.md` לפני כל עבודה על UI.

### כללים:
- עקוב אחרי Glass Dark design system — בלי חריגות.
- כל surface = glass-panel או glass-card. לעולם לא solid background.
- צבע אקסנט = כחול (#2563eb) בלבד. לא להוסיף צבעים.
- כפתורים = pill (rounded-full). Primary = כחול. Ghost = שקוף עם גבול.
- טקסט = rgba(255,255,255) עם שקיפויות (0.9 / 0.55 / 0.35). לעולם לא #fff.
- ריווח = נדיב. padding p-5 עד p-8. gap-3 עד gap-4.
- אנימציות = CSS transitions בלבד. לא framer-motion.
- RTL = logical properties בלבד (ms/me/ps/pe/border-s/border-e).
- Line-height בעברית = 1.7 לגוף, 1.4 לכותרות.
```

---

## 14. Applying to a New Project — Checklist

1. [ ] Copy `DESIGN_SYSTEM.md` to project root
2. [ ] Reference it in `CLAUDE.md` ("Read DESIGN_SYSTEM.md before any UI work")
3. [ ] Add CSS tokens from Section 2 to `globals.css`
4. [ ] Add utility classes from Section 4 to `globals.css`
5. [ ] Set `<html lang="he" dir="rtl">` and font Heebo in layout
6. [ ] Set `body { background: var(--page-bg); }` — no solid bg
7. [ ] Install `lucide-react` for icons
8. [ ] Build components from Section 5 (or copy from existing project)
9. [ ] Verify RTL with logical properties (Section 7)
10. [ ] Verify all text uses rgba, not #fff (Section 3)
