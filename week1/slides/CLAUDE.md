# Slides Project Rules

## Stack

- Slidev v51+ with Shiki highlighter, default theme, `transition: slide-left`
- Bun as package manager and runtime
- ESLint with `@eslint/markdown` + `@typescript-eslint/parser` for linting TS code blocks in `slides.md`
- Run: `make slides` or `cd slides && bunx slidev --open`
- Lint: `make lint-slides` or `cd slides && bunx eslint slides.md`

## Code Highlighting

Use slidev's built-in line-number highlighting on code fences. Do NOT use Shiki transformer comments (`// [!code highlight]`, `// [!code ++]`, `// [!code --]`, `// [!code focus]`) -- they require `@shikijs/transformers` setup which is not configured in this project and will render as literal text.

### Emphasizing key lines

Use the `{line-numbers}` syntax on the code fence to highlight important lines:

````md
```go {2-3,7,12}
// line 1 - dimmed
// line 2 - highlighted
// line 3 - highlighted
```
````

CSS in `styles/custom.css` handles the visual treatment:
- `.has-highlighted .line` -- all lines dim to `opacity: 0.35`
- `.has-highlighted .line.highlighted` -- key lines at `opacity: 1` with subtle background

Every code-heavy slide should use this to draw attention to the lines that matter. Non-highlighted lines provide context but stay out of the way.

## Code Diffs / Before-After Changes

When showing how code changes from one state to another, use **magic-move** with multiple code blocks on a single slide. Each click morphs one section. Do NOT use separate slides for Before and After.

### Single-section diffs

Two code blocks in one magic-move. The second block includes `// was {original}` inline comments on changed lines:

````md
````md magic-move
```go
client := anthropic.NewClient()
```

```go
client := openai.NewClient(               // was anthropic.NewClient()
    option.WithAPIKey(os.Getenv("KEY")),
    option.WithBaseURL("https://..."),
)
```
````
````

### Multi-section diffs (migrating a whole file)

One magic-move with N+1 code blocks where each click migrates one section. Use `// ---` section headers as scroll anchors. Wrap in `<AutoScroll>`:

```md
<AutoScroll :sections="['', '--- Section B', '--- Section C', '$bottom']">

````md magic-move
```go
// Full file in original state
// --- Section A ---
original_a()
// --- Section B ---
original_b()
// --- Section C ---
original_c()
```

```go
// Section A migrated
// --- Section A ---
migrated_a()  // was original_a()
// --- Section B ---
original_b()
// --- Section C ---
original_c()
```

// ... one block per section migrated ...
````

</AutoScroll>
```

### AutoScroll component

`components/AutoScroll.vue` wraps magic-move blocks that overflow the viewport. Props:

- `:sections` -- array of text markers matching section headers in the code. On each forward click, scrolls to the next marker BEFORE the magic-move animation plays. Special values:
  - `""` -- scroll to top
  - `"$bottom"` -- scroll to bottom
- `:delay` -- ms to pause magic-move animations while scrolling (default 600)

The first mutation after mount is skipped (initial render). The component uses `getAnimations({ subtree: true })` to pause/resume Web Animations API animations, ensuring scroll completes before the morph starts.

## Pseudocode

Style pseudocode as Python (```` ```python ````), using `def`, `snake_case`, `True`/`False`, `#` comments, and docstrings. This gives proper syntax highlighting while remaining language-agnostic in spirit.

## Side-by-Side Code (C# / TS)

Use `layout: two-cols` with `::right::` separator. Always include a per-slide `<style>` block to control font size since code must fit in half-width:

```md
---
layout: two-cols
---

# C#: Feature Name

```csharp {highlighted-lines}
// C# code
```

::right::

# TS: Feature Name

```ts {highlighted-lines}
// TS code
```

<style>
.two-cols .col-left pre, .two-cols .col-right pre {
  font-size: 0.6em; line-height: 1.35;
}
</style>
```

Font size guidelines:
- Short snippets (< 15 lines): `0.65em`
- Medium snippets (15-25 lines): `0.6em`
- Long snippets (25+ lines): `0.55em` or `0.5em`

## Step-by-Step Reveals

Use `<v-clicks>` for bullet lists and `<v-click>` for individual blocks:

```md
<v-clicks>

- First point
- Second point

</v-clicks>

<v-click>

Block revealed on next click.

</v-click>
```

## Linting

All TS code blocks in `slides.md` must pass `bunx eslint slides.md`. This means:
- TS snippets must be syntactically valid standalone (no anonymous `async function(input)` -- use named functions)
- Object literals shown as snippets should be wrapped in a `const x = { ... }` assignment
- Method definitions (like `startSpinner(): void { ... }`) need to be written as `function startSpinner(): void { ... }`
- C# code blocks are not linted (no C# eslint plugin)

## File Organization

```
slides/
  slides.md              # All slide content (single file)
  package.json           # Slidev deps + eslint deps
  eslint.config.js       # Lints TS blocks in slides.md
  components/
    AutoScroll.vue       # Scroll-before-animate wrapper for tall magic-move blocks
  styles/
    custom.css           # Global overrides (highlight opacity, diff markers, two-cols sizing)
  snippets/              # Reserved for external snippet imports (<<< @/snippets/...)
```

## Things That Do NOT Work

- `// [!code highlight]` / `// [!code ++]` / `// [!code --]` -- requires `@shikijs/transformers` setup
- `{monaco-diff}` code blocks -- requires Monaco editor addon
- `v-bind()` in `<style>` blocks in custom components -- causes build errors in slidev
- Importing `@slidev/client/context` in custom components -- causes dynamic import failures; use plain DOM APIs instead
