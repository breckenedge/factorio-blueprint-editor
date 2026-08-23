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

Never commit or push without being asked. Never force-push.

## Verification

Run one command:

```
npm run check   # prettier + lint ratchet + typecheck ratchet + vitest
```

It is the gate every change clears before you call it done. `npm run build:website` is separate,
and note that Vite **strips types without checking them** — a green build says nothing about
type correctness.

Both eslint and tsc carry a backlog on `master`: **94 lint errors** across 15 files, and
**82 type errors** concentrated in `packages/editor/src/core/spriteDataBuilder.ts` (57). Neither
can reach zero without a large cleanup, so both go through `scripts/ratchet.mjs`, which compares
per-file counts against `lint-baseline.json` and `typecheck-baseline.json` and fails only on an
increase. Don't try to reach zero, and don't report the pre-existing problems as if a change
caused them. If a change genuinely reduces a count, the ratchet says so — lock it in with
`npm run lint:ratchet -- --update` or the typecheck equivalent.

The ratchets also fail outright when a checker didn't actually inspect anything — tsc aborting on
`TS2688`, or eslint matching no files. Both produce a low error count that reads as a large
improvement, so treat "the check did not run" as a broken toolchain, never as progress.

Tests live next to their subjects as `*.test.ts` and cover `History`, `PositionGrid`, and the
blueprint-string round-trip. Coverage stops there: **nothing tests the Pixi containers, the
`EditorMode` state machine, or viewport logic**, which is most of what the mobile work touches.
When a change lands in untested territory, say so plainly rather than implying `npm run check`
verified it.

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
