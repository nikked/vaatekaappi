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
| Screens     | Wardrobe, Outfits                                                   |
| Language    | UI in Finnish, code in English                                      |
| Photos      | JPEG/PNG only (iPhone "Most Compatible"). Backgrounds not plain     |
| Examples    | One-time manual conversion of `vaatteet.json` → `examples.json`     |
| Prefill     | Category (zero-shot + examples), colors (suggested, user confirms)  |
| Add flow    | Small batch first, then one at a time; same fast prefill for both   |
| Outfits     | Fixed templates, hard filters, palette + color-theory ranking       |
| Palette     | Warm autumn, fixed palette constant                                 |
| Dress me    | v1: flat-lay collage. Photo try-on decided after spike, not in v1   |
| Embeddings  | `Xenova/clip-vit-base-patch32` via transformers.js (WebGPU)         |
| Backup      | Export/import single JSON file, images as data URLs                 |
| Name        | Kaappi                                                              |
| Design      | Mockup as is: `mockups/index.html` (cream, terracotta, Fraunces)    |
| Fonts       | Fraunces + Nunito Sans, bundled in the repo (no Google Fonts)       |
| Photos      | Background removed once on add; cut-outs used in cards and collages |
| Devices     | Laptop only for now; phone layout kept. Hosting and sync later      |

## Data model

```ts
type Garment = {
  id: string;
  name: string;
  description: string;
  image: Blob;
  category: Category;     // leaf of the category tree
  colors: Rgb[];          // 1–2, confirmed by the user
  pattern: "solid" | "patterned";    // #yksivärinen / #kuviollinen
  occasions: Occasion[];  // #arki → everyday, #juhla → party
  warmth?: "warm" | "cool";          // #lämmin / #viileä: garment warmth
  bikeable: boolean;      // #pyöräily, only meaningful for bottoms
  favourite: boolean;     // #lempivaatteet
  embedding: Float32Array;
};

type Slot = "top" | "bottom" | "dress" | "outer";

type OutfitTemplate = {
  required: Slot[];
  optional: Slot[];
};

type Outfit = {
  garmentIds: string[];
  score: number;
};
```

Color tags (#musta, #vihreä, …) are dropped; hex colors cover them.

Category tree (from `vaatteet.json`, plus `Takit > Sisätakit`):

| Category                                         | Slot   |
| ------------------------------------------------ | ------ |
| Yläosa > Pitkähihaiset > Kauluspaidat / Neulepaidat / Neuletakit | top |
| Yläosa > Pitkähihaiset > Bleiserit               | outer  |
| Yläosa > Lyhythihaiset > Kauluspaidat / T-paidat | top    |
| Alaosa > Housut / Hameet (Pitkät, Lyhyet) / Shortsit | bottom |
| Mekot                                            | dress  |
| Takit, Takit > Sisätakit                          | outer  |
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
- Occasion (Arki / Juhla), weather (Lämmin / Viileä) and Pyöräily pickers →
  ranked list of generated outfits. Each card shows 5 score dots; the best one
  gets a "Sopii sinulle" badge. No explanation text.
- Pick an outfit, or swap single garments → dress me: collage of garment images
  laid out by slot.

## Steps

### 0. App shell (done) and example data
- App shell with two screens, IndexedDB storage, JSON export/import.
- Convert `vaatteet.json` by hand to `examples.json` with fixes: the skirt's ID
  is 4364 (photo `IMG_4364`), description "Kiva hame arkeen ja juhlaan";
  normalize category paths; denim shirt and blazer move to Takit > Sisätakit;
  `##cc99ff` → `#cc99ff`; skirt gets two colors.
- Convert the 7 HEIC photos once to JPEG with macOS `sips`.
- Replace placeholder categories and fields in `garment.ts` with the model above.

### 1. Recognize and prefill
- Background removal: on add, a segmentation model via transformers.js cuts the
  garment out once; the cut-out (PNG with alpha) is stored next to the
  original. Pick the model when building it (check its license fits personal
  use).
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

### 2. Outfits (logic done, UI and collage to do)
All pure functions over `Garment[]`:
- **Generate:** fill template slots from the wardrobe.
- **Filter:** every garment has the chosen occasion; cold weather excludes
  `cool` garments, warm weather excludes `warm` ones, untagged fit both;
  Pyöräily requires a bikeable bottom (or no bottom); at most one patterned
  item.
- **Score:**
  - Palette fit: distance of the worst-fitting garment's dominant color to the
    nearest palette color (a mean would reward adding any on-palette layer).
  - Color theory, in LCh: low-chroma colors count as neutrals and go with
    anything. Non-neutral hues score for analogous (≤60°) or complementary
    (~180°) relationships, are penalized when they clash, and when there are
    more than 2 non-neutral hues. One color + neutrals gets the same baseline
    as a good pair, so adding layers is neither rewarded nor punished.
- Collage: draw garment images on a canvas laid out by slot.
- **Verify:** dense unit tests for generate, filter and each score part; run
  end to end on the real wardrobe and check that the top-ranked outfits look
  right.

### 3. Apply the design
- Copy theme tokens and layouts from `mockups/index.html` into the app; bundle
  the fonts.
- **Verify:** compare desktop and phone screenshots against the mockup.

### Parallel: try-on spike (no code)
- In the ChatGPT app (existing subscription): own photo + 2–3 garment photos,
  ~5 outfits. Optionally compare Gemini.
- Decides whether photo try-on (cloud) goes into a later version.

## Later
- Hosting (static) and moving the wardrobe between devices.
