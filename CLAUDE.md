# factorio-blueprint-editor

A fork of [teoxoy/factorio-blueprint-editor](https://github.com/teoxoy/factorio-blueprint-editor)
(MIT, upstream archived as unmaintained). Active work: adding mobile/touch support.

## Workflow — branches and PRs, never direct edits to master

**Do not edit files on `master`.** Before making any code change:

1. Confirm the change is wanted. Reading a plan or a ticket is not authorization to write code.
2. `git switch -c <branch>` off an up-to-date `master`.
3. Make the change, then open a PR with `gh pr create`.

One PR does one thing. If a task can't be reviewed in a single sitting, it's too big —
split it and say so rather than opening a sprawling PR.

Never commit or push without being asked. Never force-push. Never merge your own PR.

## Verification

There are **no tests** in this repo — no `.test.ts`, no `.spec.ts`, nothing. Do not claim a
change is "tested."

`npm run build:website` uses Vite, which **strips types without checking them**. A green build
says nothing about type correctness. Run both:

```
npm run type-check      # tsc
npm run lint            # eslint
npm run build:website   # vite
```

`type-check` is **not clean on master** — it reports 82 pre-existing errors, concentrated in
`packages/editor/src/core/spriteDataBuilder.ts` (57), `UI/EntityInfoPanel.ts` (10),
`core/Entity.ts` (5), `containers/UnderlayContainer.ts` (5), `containers/OverlayContainer.ts` (4),
`containers/PaintEntityContainer.ts` (1). Compare the **count and the affected files** against
that baseline; don't try to reach zero, and don't report the pre-existing errors as if the
change caused them.

Since the type-checker is already red and there is no test suite, there is no automated signal
that a change to pointer handling, `EditorMode`, or viewport logic still works. Say so plainly
instead of implying a change is verified.

## Layout

npm workspaces monorepo:

- `packages/website` — entry point, page shell, URL/clipboard blueprint import, settings pane
- `packages/editor` — the actual editor: Pixi containers, UI panels, `actions.ts` keybinds
- `packages/exporter` — Rust; extracts game assets. Not part of the JS build.

`functions/corsproxy.js` is a Cloudflare Pages Function that external import sources
(pastebin, gist, factorioprints, factoriobin) route through. It needs a deployment of its own
or those paths fail silently.

## Mobile work — context

- Mobile detection is `isMobile.any` from `pixi.js`, surfaced as a `mobile` class on `<body>`
  in `packages/website/src/index.ts`. Hook touch-specific CSS off that.
- `?source=` URL import is independent of the clipboard path and is the primary mobile entry
  point. The `copy`/`paste` document listeners are gated on `document.activeElement !== CANVAS`
  and are not viable on mobile.
- There is **no selection model**. `BlueprintContainer.ts` tracks only `hoverContainer` and
  enters `EditorMode.EDIT` by hovering; every edit operation reads `this.hoverContainer.entity`.
  Any editing-on-touch work depends on building persistent selection first.

## Assets

The `.basis` textures and `data.json` under `packages/exporter/data/output` derive from
Factorio's copyrighted assets. The MIT license covers teoxoy's code only and grants nothing
over Wube's artwork. This is unresolved — treat public hosting as blocked until it is.
