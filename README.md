# Kaappi

A wardrobe in the browser for one person: photograph your clothes once, and Kaappi
suggests outfits from them, ranked by how well their colors go together and with your
color season. The UI is in Finnish.

**[nikked.github.io/vaatekaappi](https://nikked.github.io/vaatekaappi/)**

**Vaatekaappi** is the wardrobe. Drag photos onto it from Finder or the Photos app, or
use **Lisää kuvia**. Each photo has its background removed and gets a suggested
category, pattern and colors, which you confirm in a review queue one garment at a
time. The first start downloads the image models (about 300 MB) and caches them in the
browser; a banner shows the progress.

**Asut** lists outfits: a top and a bottom, or a dress, each with an optional layer or
coat. Filter by occasion (arki / juhla), by whether the outfit can be biked in, or by
one garment to see what goes with it. **Sopivuus** shows how well each outfit fits;
hover it for an explanation. **Vaihda osa** swaps a single garment.

**Värini** sets the color season (12 types) and its palette, which the outfit score
uses.

Everything lives in the browser that entered it, so **⋯ → Vie varmuuskopio** is the
backup: a zip with every original photo, the cut-outs, and `vaatteet.json` holding all
garment data and the color settings. **Tuo varmuuskopio** restores it, and backups from
any earlier version still import.

## Running it

```sh
make dev               # http://localhost:5173
make test              # vitest
make build             # tsc && vite build
make lint              # biome lint, fixing what it can
make format            # biome format
make qa-check          # everything CI runs
make test-integration  # the real models on initial_data/ photos (local only)
```

Every target installs first, so `make dev` on a fresh clone is the whole setup. CI runs
`tc`, `test`, `lint-check` and `format-check` on every push and pull request. Merging to
`main` deploys the site; any branch can be deployed by hand with **Run workflow** on the
`pages` workflow.

Vite, React and TypeScript with `strict` on. One stylesheet, no UI framework. The image
models run in the browser with transformers.js: RMBG-1.4 removes backgrounds (its
license allows personal, non-commercial use) and SigLIP suggests categories and
patterns. fflate reads and writes the backup zips.

## Design

[`PLAN.md`](PLAN.md) covers the data model and how stored data stays readable by every
future version, the outfit rules and scoring, and the decisions behind them.
[`docs/backlog.md`](docs/backlog.md) lists what is known to be left to do.
