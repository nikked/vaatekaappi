# Plan

Browser app for a single user's wardrobe (<100 garments). Develop on M5, must run
on M1 Air 16 GB.

## Scope

**v1:** Wardrobe (add, prefill, edit) and Outfits (generated combos, dress me as
collage).

**Later:** Insights (missing colors, missing item types, shopping links),
photo-based try-on, profile photos.

## Decisions

| Topic       | Decision                                                            |
| ----------- | ------------------------------------------------------------------- |
| Platform    | Browser: Vite + React + TypeScript, data in IndexedDB, no backend   |
| Users       | One person, one wardrobe, one profile                               |
| Screens     | Vaatekaappi, Asut, Värini                                           |
| Language    | UI in Finnish, code in English                                      |
| Photos      | JPEG/PNG only (iPhone "Most Compatible"). Backgrounds not plain     |
| Examples    | One-time manual conversion of `vaatteet.json` → `examples.json`     |
| Prefill     | Category (zero-shot + examples), colors (suggested, user confirms)  |
| Add flow    | Small batch first, then one at a time; same fast prefill for both   |
| Outfits     | Fixed templates, hard filters, palette + color-theory ranking       |
| Palette     | Season type (12) + editable palette in the Värini tab; warm autumn default |
| Dress me    | v1: flat-lay collage. Photo try-on decided after spike, not in v1   |
| Embeddings  | `Xenova/siglip-base-patch16-224` q8 via transformers.js (WebGPU)    |
| Cut-outs    | `briaai/RMBG-1.4`: WebGPU fp16, WASM q8 fallback (personal use only) |
| Backup      | Zip: vaatteet.json + original photos + cut-outs; old JSON imports   |
| Name        | Kaappi                                                              |
| Design      | Mockup as is: `mockups/index.html` (cream, terracotta, Fraunces)    |
| Fonts       | Fraunces + Nunito Sans, bundled in the repo (no Google Fonts)       |
| Photos      | Background removed once on add; cut-outs used in cards and collages |
| Devices     | Laptop only for now; phone layout kept. Hosting and sync later      |

## Data model

Defined in `src/garment.ts`. The user enters her clothes once, so stored data
must stay readable by every future version:

- **Input vs derived.** What she enters (photo at max 2048 px, name,
  description, brand, material, fit/style notes, category, colors, tags) is
  kept forever. Cut-out and embedding are derived, labelled with the models
  that made them (`derivedBy`), and recomputed from the photo when that changes.
- **Stable category ids** (`layer-blazer`); the Finnish tree is only a label.
- **Versioned records.** Every garment has `schema`; `src/migrate.ts` turns any
  older shape into the current one. Used for both the database (on every read)
  and backup imports. Unreadable records stay in the database untouched.
- **Fixtures.** `src/fixtures/` keeps a backup file per schema; tests import
  them. Never delete a migration step or a fixture.
- **Backups.** "Vie varmuuskopio" writes a zip: `vaatteet.json` (all input and
  the color profile), `kuvat/` (original photos), `leikatut/` (cut-outs). Older
  single-JSON backups still import. The app asks the browser for persistent
  storage.

Color tags (#musta, #vihreä, …) are dropped; hex colors cover them.

Category tree (from `vaatteet.json`, plus a Päällysosat group for garments
never worn without a top):

| Category                                         | Slot   |
| ------------------------------------------------ | ------ |
| Yläosa > Pitkähihaiset > Kauluspaidat / Neulepaidat | top |
| Yläosa > Lyhythihaiset > Kauluspaidat / T-paidat | top    |
| Alaosa > Housut / Hameet (Pitkät, Lyhyet) / Shortsit | bottom |
| Mekot                                            | dress  |
| Päällysosat > Sisätakit / Bleiserit / Neuletakit | outer  |
| Takit (outdoor coats)                            | outer  |
| Sukat, Kengät (…), Päähineet (…), Korut, Asusteet, Alusvaatteet | none yet |

Categories without a slot are stored but not used in outfits until they are
added later.

Templates: `top + bottom (+ outer)`, `dress (+ outer)`.

## Screens

### Vaatekaappi
- Grid of garment cards (cut-out photo, name, color dots, heart), filter chips
  by top-level category plus Lempivaatteet. Export/import behind a "⋯" menu.
- Drop one or many photos → a banner ("5 uutta kuvaa odottaa tarkistusta")
  opens the review queue (Tarkistus). Each item shows the photo and
  prefilled fields. For each attribute, the top 3 suggestions appear as chips,
  best one preselected; one click changes it, Enter confirms and moves to the
  next item.
- Click a garment → same edit form.
- Export / import JSON.

### Asut
- Occasion (Arki / Juhla) and Pyöräily pickers, with the number of outfits →
  ranked list of generated outfits. Each card shows 5 score dots; the best one
  gets a "Sopii sinulle" badge. No explanation text.
- Pick an outfit, or swap single garments → dress me: collage of garment images
  laid out by slot.

### Värini
- Pick one of the 12 season types; its preset palette (an approximation)
  replaces the current one. Edit, add and remove palette colors, or reset.
- Saved immediately, included in backups, and used for the palette-fit score.

## Steps

### 0. App shell (done) and example data
- App shell with two screens, IndexedDB storage, JSON export/import.
- Convert `vaatteet.json` by hand to `examples.json` with fixes: the skirt's ID
  is 4364 (photo `IMG_4364`), description "Kiva hame arkeen ja juhlaan";
  normalize category paths; denim shirt and blazer move to Takit > Sisätakit (now Päällysosat > Sisätakit);
  `##cc99ff` → `#cc99ff`; skirt gets two colors.
- Convert the 7 HEIC photos once to JPEG with macOS `sips`.
- Replace placeholder categories and fields in `garment.ts` with the model above.

### 1. Recognize and prefill (done)
- Background removal: on add, RMBG-1.4 cuts the garment out once; the cut-out
  (PNG with alpha) is stored next to the original. BiRefNet-lite (MIT) was
  tried first: it exceeds Apple GPUs' WebGPU limits and runs out of WASM memory.
- Load the models at app start so it is warm before the first upload; cache it in
  the browser after first download.
- Category: compute embedding on drop. Zero-shot similarity against a text
  prompt per category (e.g. "a photo of a long skirt"), combined with k-NN
  over confirmed garments; examples gain weight as their count grows. Top 3
  become suggestion chips. Confirmed garments become new examples.
- Pattern: zero-shot ("a plain single-colored garment" vs "a patterned
  garment").
- Colors: the existing extraction on the cut-out's opaque pixels suggests 1–2
  colors; the user confirms or corrects with a color
  picker. Confirmed hex values are the truth.
- Tags (occasion, warmth, pyöräily, favourite) are toggles, not predicted.
- **Verify:** held-out accuracy per attribute on labelled examples (also try
  `Xenova/siglip-base-patch16-224` and keep the better one); time from drop to
  suggestions on the M1 Air; unit tests for masking and color clustering.
- **Result (M5, headless Brave):** SigLIP 6/7 categories first, 7/7 in top 3
  (CLIP 4/7); pattern 7/7. ~1.4 s from photo to suggestions once models are
  loaded; first load downloads ~300 MB. Suggested colors are darker than the
  user's picks (indoor lighting), so the color picker stays essential. Not yet
  measured on the M1 Air.

### 2. Outfits (done)
All pure functions over `Garment[]`:
- **Generate:** fill template slots from the wardrobe.
- **Filter:** every garment has the chosen occasion; at most one patterned
  item. Pyöräily: all outfits, only bikeable ones, or only ones to avoid on a
  bike. A bottom or dress marked "Ei sovellu pyöräilyyn" (`noBiking`, its own
  form field) makes the outfit unbikeable. Warmth is stored but not used.
- **Score:**
  - Palette fit: distance of the worst-fitting garment's dominant color to the
    nearest palette color (a mean would reward adding any on-palette layer).
  - Color theory, in LCh: low-chroma colors count as neutrals and go with
    anything. Non-neutral hues score for analogous (≤60°) or complementary
    (~180°) relationships, are penalized when they clash, and when there are
    more than 2 non-neutral hues. One color + neutrals gets the same baseline
    as a good pair, so adding layers is neither rewarded nor punished.
- Collage: cut-outs laid out by slot with CSS grid (no canvas needed until an
  outfit has to be saved as an image).
- Score shown as 5 dots relative to the listed outfits, with a minimum spread
  so nearly equal outfits don't look far apart in a short list.
- **Verify:** dense unit tests for generate, filter and each score part; run
  end to end on the real wardrobe and check that the top-ranked outfits look
  right.

### 3. Apply the design (done)
- Copy theme tokens and layouts from `mockups/index.html` into the app; bundle
  the fonts.
- **Verify:** compare desktop and phone screenshots against the mockup.
- Deviation: "Lisää kuvia" and the "⋯" menu sit in the Vaatekaappi heading,
  not the top bar, so wardrobe state stays in the Wardrobe screen.
- Stored cut-outs are cropped to the garment; embeddings still use the
  uncropped cut-out (cropping dropped category accuracy from 6/7 to 4/7).

### Parallel: try-on spike (no code)
- In the ChatGPT app (existing subscription): own photo + 2–3 garment photos,
  ~5 outfits. Optionally compare Gemini.
- Decides whether photo try-on (cloud) goes into a later version.

## Later
- Hosting (static) and moving the wardrobe between devices.
