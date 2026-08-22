<img src="./.github/logo.svg" width="100%" align="right">

# factorio-blueprint-editor (unmaintained)

[![Website](https://img.shields.io/website-up-down-brightgreen-red/https/fbe.teoxoy.com.svg?style=flat-square)](https://fbe.teoxoy.com)
[![Discord](https://img.shields.io/discord/540738973413408809.svg?style=flat-square&color=7289da&logo=discord&logoColor=white)](https://discord.gg/c5eXyBU)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg?style=flat-square)](./CONTRIBUTING.md)
&nbsp;&nbsp;_Badges are clickable!_

A feature-rich [Factorio](https://www.factorio.com) Blueprint Editor. You can now edit your blueprints in the browser!

![Preview](./.github/preview.png)

Sample blueprint: https://fbe.teoxoy.com/?source=https://pastebin.com/uc4n81GP

Example blueprint book: https://fbe.teoxoy.com/?source=https://pastebin.com/Xp9u7NaA&index=1

# Features

- rendering and editing blueprints
- history (undo/redo)
- copy and delete selections
- import blueprints and books from multiple sources (direct bp string, pastebin, hastebin, gist, gitlab, factorioprints, factorio.school, google docs)
- generating blueprint images
- oil outpost generator
- customizable keybinds
- "creative" entities

# Running locally

The app needs two servers: the Vite dev server on **8080**, and a static server on **8081**
serving the extracted game assets. Vite proxies `/data` to 8081 in dev, so without the second
server every asset 500s and the editor renders nothing.

The extracted assets are checked into this repo at `packages/exporter/data/output`, so you do
**not** need the Rust toolchain or a Factorio account just to run the app:

```sh
npm install

# terminal 1 — assets on 8081
npx http-server -p 8081 --cors -s packages/exporter/data/output

# terminal 2 — app on 8080
npm run start:website
```

Then open <http://localhost:8080>.

Only re-extract assets if you need to update them for a new Factorio version — that path needs
[rust](https://rust-lang.org) and Factorio credentials in `packages/exporter/.env`, and is run
with `npm run start:exporter` (which also serves 8081, replacing the `http-server` command
above). See [CONTRIBUTING.md](./CONTRIBUTING.md).

Note that `/corsproxy` proxies to `https://fbe.teoxoy.com` in dev, so the external import
sources work locally without deploying your own proxy. That only matters in production.

## Checks

```sh
npm run type-check   # tsc
npm run lint         # eslint
npm run build:website
```

`build:website` uses Vite, which strips types without checking them — a green build says
nothing about type correctness, so run `type-check` separately. It is **not clean**: there are
82 pre-existing errors on `master`, mostly in `packages/editor/src/core/spriteDataBuilder.ts`.
Compare against that baseline rather than expecting zero. There is no test suite.

# Contributing

Check out [this readme](./CONTRIBUTING.md) if you are interested in contributing.

# Credits

Thanks to all contributors!

Thanks to everyone who submitted bugs and feature requests on github and doorbell.io!

Thanks to the factorio player GamesDan for reporting a lot of issues via doorbell!
