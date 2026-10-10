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
| Photos      | Garments on plain background, same lighting                         |
| Examples    | Own structured format, images tagged by id → convert to JSON first  |
| Prefill     | Category, colors, season, formality, pattern/material               |
| Add flow    | Small batch first, then one at a time; same fast prefill for both   |
| Outfits     | Fixed templates, hard filters, palette + color-theory ranking       |
| Palette     | Season type (e.g. "soft autumn") mapped to a fixed palette          |
| Dress me    | v1: flat-lay collage. Photo try-on decided after spike, not in v1   |
| Embeddings  | `Xenova/clip-vit-base-patch32` via transformers.js (WebGPU)         |
| Backup      | Export/import single JSON file, images as data URLs                 |

## Data model

```ts
type Garment = {
  id: string;
  image: Blob;
  category: Category;
  colors: Rgb[];          // dominant, ordered by pixel share
  season: Season[];
  formality: Formality;
  pattern: Pattern;
  embedding: Float32Array;
};

type Profile = {
  season: SeasonType;     // → palette lookup
};

type Slot = "top" | "bottom" | "dress" | "shoes" | "outer";

type OutfitTemplate = {
  required: Slot[];
  optional: Slot[];
};

type Outfit = {
  garmentIds: string[];
  score: number;
};
```

`Category`, `Season`, `Formality`, `Pattern` are string-literal unions built from
the category list (still to be provided). Each `Category` maps to exactly one
`Slot`.

Templates: `top + bottom + shoes (+ outer)`, `dress + shoes (+ outer)`.

## Screens

### Wardrobe
- Grid of garments, filter by category.
- Drop one or many photos → review queue. Each item shows the photo and
  prefilled fields. For each attribute, the top 3 suggestions appear as chips,
  best one preselected; one click changes it, Enter confirms and moves to the
  next item.
- Click a garment → same edit form.
- Export / import JSON.

### Outfits
- Season + formality picker → ranked list of generated outfits.
- Pick an outfit, or swap single garments → dress me: collage of garment images
  laid out by slot.

## Steps

### 0. Importer and app shell
- Script converting the existing structured format to `examples.json`
  (`{ id, category, season, formality, pattern }[]`) matched to images by id.
- App shell with two screens, IndexedDB storage, JSON export/import.
- **Verify:** importer unit tests on a sample of the real format; export →
  import round-trip test.

### 1. Recognize and prefill
- Load the model at app start so it is warm before the first upload; cache it in
  the browser after first download.
- Compute embedding on drop; k-NN over labelled example embeddings for
  category, season, formality, pattern. Top 3 neighbours' labels become the
  suggestion chips. Confirmed garments become new examples.
- Colors: estimate background color from the image border, mask pixels close
  to it (ΔE in Lab), k-means (k≈3) on the rest. If the mask removes almost
  everything (garment same color as background), flag colors as uncertain.
- Aim for ≥5 labelled examples per category.
- **Verify:** held-out accuracy per attribute on labelled examples (also try
  `Xenova/siglip-base-patch16-224` and keep the better one); time from drop to
  suggestions on the M1 Air; unit tests for masking and color clustering.

### 2. Outfits
All pure functions over `Garment[]`:
- **Generate:** fill template slots from the wardrobe.
- **Filter:** every garment matches the chosen season and formality; at most one
  patterned item.
- **Score:**
  - Palette fit: each garment's dominant color distance to the nearest palette
    color.
  - Color theory, in LCh: low-chroma colors count as neutrals and go with
    anything. Non-neutral hues score for analogous (≤30°) or complementary
    (~180°) relationships, are penalized when they clash, and when there are
    more than 2 non-neutral hues.
- Collage: draw garment images on a canvas laid out by slot.
- **Verify:** dense unit tests for generate, filter and each score part; run
  end to end on the real wardrobe and check that the top-ranked outfits look
  right.

### Parallel: try-on spike (no code)
- In the ChatGPT app (existing subscription): own photo + 2–3 garment photos,
  ~5 outfits. Optionally compare Gemini.
- Decides whether photo try-on (cloud) goes into a later version.

## Inputs still needed
- Category list, each category's slot, and allowed values for season,
  formality, pattern.
- Sample of the structured example format.
- Season type and which season→palette mapping to use.
