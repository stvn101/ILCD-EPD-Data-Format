# ILCD-EPD Data Format

Two parallel tracks live in this repo. They share a name but no git history.

## Branches

| Branch | What it is |
| --- | --- |
| **`master`** *(default)* | The **EPD generator** — a React + TypeScript wizard that produces ILCD+EPD v1.3 datasets (process XML, flow XML with MatML, contact/source XMLs, ILCD ZIP). All app code lives under [`epd-generator/`](epd-generator/). |
| `release/v1.3` | A fork of the upstream **ILCD-EPD spec** at [Inwistand/ILCD-EPD-Data-Format](https://github.com/Inwistand/ILCD-EPD-Data-Format) — XSD schemas, build scripts, HTML reference docs. Vendored as reference material; the generator imports CSV identifiers from a local copy at build time. |

Switch with `git checkout master` / `git checkout release/v1.3`. The two histories don't merge — they're co-located by accident of forking, not design.

## Directory layout

```
ILCD-EPD-Data-Format-release-v1.3/         <- repo root
├── epd-generator/                         <- the React/TS wizard (master branch)
│   ├── src/
│   │   ├── components/steps/              <- Step1..Step7 wizard UI
│   │   ├── generators/xml/                <- process / flow / contact / source XML emitters
│   │   ├── generators/zip-generator.ts    <- bundles everything into ILCD/<...>/<uuid>.xml
│   │   ├── schema/                        <- CSV parsers + browser registry (?raw imports)
│   │   ├── validation/                    <- field rules, cross-ref check, indicator coverage
│   │   └── model/epd-dataset.ts           <- the EPDDataset shape
│   ├── HANDOFF.md                         <- session-handover notes (current state)
│   └── todos.md                           <- 9-task gap-closure plan (all done) + open follow-ups
└── ILCD-EPD-Data-Format-release-v1.3/     <- vendored spec bundle (gitignored)
    └── doc/identifiers/                       (referenced by ?raw CSV imports at build time)
```

The nested `ILCD-EPD-Data-Format-release-v1.3/` directory is **not committed** — it's gitignored. Obtain it locally from the upstream spec release (or from `release/v1.3` in this repo) and unpack it next to `epd-generator/` so the `?raw` CSV imports resolve.

## Working on the generator

```bash
cd epd-generator
npm install
npm run dev          # local dev server (Vite) on http://localhost:5173
npx vitest run       # 152 tests, all green
npm run build        # clean TS build → dist/
```

## Validating an exported dataset

The generator's internal validation (Task 7) checks cross-references and indicator coverage *during authoring*. For independent **schema-level validation** of an exported `.zip`, use the okworx ILCD Validation Tool — it's a separate Eclipse-RCP desktop application, not part of this repo.

1. Download the prebuilt release for your OS from <https://www.okworx.com/software/> (or the [Bitbucket source](https://bitbucket.org/okusche/ilcdvalidationtool/) if you want to build it yourself — JDK 11 + Maven 3.8 required).
2. Launch the GUI.
3. Drag-and-drop the ZIP exported from Step 7 of the wizard onto the validator.
4. Pick the EPD profile that matches your standard version (`+A1`, `+A2/EF3.0`, or `+A2/EF3.1`).

This is a manual step — automating it would require building the Eclipse RCP app from source, which is high cost for a one-off validation.

## Status

The 9-task v1.3 gap-closure plan is **complete** (see [`epd-generator/todos.md`](epd-generator/todos.md) for the per-task notes and [`epd-generator/HANDOFF.md`](epd-generator/HANDOFF.md) for the current session-handover summary). 152/152 vitest tests pass; production build is clean (~188 kB main / ~60 kB gzipped).

**Open follow-ups** (captured in `todos.md`):

- **Australia / Oceania country-specific indicators** — needs an upstream PR to <https://github.com/Inwistand/ILCD-EPD-Data-Format>; local-only fabricated UUIDs would break cross-reference validation against real ILCD validators.
- `referenceToOriginalEPD` / `referenceToPublisher` placement (currently in `publicationAndOwnership`; v1.3 sample puts them in `dataSourcesTreatmentAndRepresentativeness/common:other`).
- Contact `entityIds` (VATID/TIN/openEPD) not yet captured in the data model.
- Per-contact / per-source classifications — wizard captures one default; sample EPDs use richer trees.
- Click-to-fix DOM-id coverage for the remaining `Reference` paths (compliance refs, dataSetFormat, all `publicationAndOwnership.*Ref`, all `processInfo.serviceLife.*Ref`, all `sources.*` except PCR).
