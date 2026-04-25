# Handoff — `epd-generator` gap-closure plan

This file is a quick read for a fresh chat picking up the work mid-stream.

## Where things stand

**All 9 tasks done.** All Task 1–9 work landed on the working tree
(uncommitted) and **152/152 vitest tests pass**. `npm run build` produces
a clean TS build (~188 kB main bundle / ~60 kB gzipped).

| Done | Task |
| --- | --- |
| ✅ | 1 — SVHC casing + variability namespace bugs in `process-xml.ts` |
| ✅ | 2 — `epd2:contentDeclaration` emission |
| ✅ | 3 — Real Flow XML generator (`src/generators/xml/flow-xml.ts`) replaces the ZIP stub |
| ✅ | 4 — Rich `epd24:` v1.3 fields: productIds, serviceLife (+ estimatedServiceLife with use-condition factors), scenarioData (useStage + EoL), manufacturers/sites, pcrCompliance, expirationDateOfEPD; consolidated `<common:other>` blocks; minimum-viable UI in Step 2 + Step 4 |
| ✅ | 5 — Contact/Source XML generators + dedupe walker bundled into ZIP under `ILCD/contacts/` and `ILCD/sources/`; authoritative refs (compliance system, ILCD format) skipped |
| ✅ | 6 — Registry-driven dropdowns: Step 3 declared units (11 from `Flow_properties_and_unit_groups.csv`), Step 6 background DBs (24 GaBi + 17 ecoinvent via new `parseBackgroundDbCSV`), compliance UUID confirmed already present in `Common_references.csv` |
| ✅ | 7 — Cross-reference + indicator-completeness validation: `findUnresolvedReferences` walks every Reference and resolves against bundled+authoritative UUID sets; `findIndicatorCoverageGaps` warns per missing `(declared module, LCIA indicator)` cell. Browser loader split into `src/schema/browser-registry.ts` (with `?raw`) vs pure builder in `src/validation/authoritative-uuids.ts` so vitest doesn't try to evaluate `?raw` outside the workspace |
| ✅ | 8 — Click-to-fix navigation: Step 7 validation rows are buttons that `setStep(issue.step - 1)` then poll for `getElementById(issue.field)` via `requestAnimationFrame`, scrolling and focusing the matching input. `ValidatedInput` auto-applies `id={fieldId}`; plain inputs renamed to validator-path ids (`processInfo.location`, `productFlow.name`, etc.); `IndicatorMatrix` accepts an `idPrefix` so every LCIA cell is deep-linkable from a coverage warning |
| ✅ | 9 — End-to-end smoke test: TS errors cleaned up (`vite.config.ts` switched to `defineConfig` from `vitest/config`; unused `import React`s removed); new `e2e-smoke.test.ts` builds a fully populated +A2/EF3.1 dataset and asserts XML contents, ZIP folder structure (1 process + 1 flow + 7 contacts + 5 sources), referential integrity (every `refObjectId` resolves), and clean validation. Live wizard verified: empty dataset gates exports, fixing `processInfo.name` unlocks them, "Export ILCD ZIP" runs without runtime errors |
| ⬜ | 7 — Cross-reference + indicator-completeness validation |
| ⬜ | 8 — Click-to-fix navigation in the Step 7 validation panel |
| ⬜ | 9 — End-to-end smoke test (vitest + build + manual wizard run + ILCD validator) |

## How to verify the current state in a fresh chat

```bash
cd C:/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run        # expect: 12 files, 152 tests, all pass
npm run build         # clean TS build
```

## What to do first in the new chat

The original 9-task gap-closure plan is **complete**. The "Open follow-ups"
section at the bottom of `epd-generator/todos.md` lists items the user has
explicitly asked to defer or that came up mid-stream. Highest-priority next
items, in user-stated order:

1. **Australia / Oceania country indicators** (user-confirmed): submit a PR
   to the upstream spec at https://github.com/Inwistand/ILCD-EPD-Data-Format
   adding AU/NZ entries to `Country-specific_indicators.csv`. Local-only
   additions would break Task 7 cross-reference validation against real ILCD
   validators, so this needs upstream registration of the indicator UUIDs
   first. Don't fabricate UUIDs.
2. Other follow-ups (any order): `referenceToOriginalEPD` /
   `referenceToPublisher` placement bug, contact `entityIds` support,
   per-contact / per-source classifications captured by the wizard,
   browser-registry consolidation, click-to-fix coverage for the remaining
   reference paths.

The user has not asked for a commit yet. Don't commit unprompted.

## Key architectural facts to remember

- **Three standard versions**: `+A1`, `+A2/EF3.0`, `+A2/EF3.1`. Each has a
  feature flag set in `src/schema/standard-configs.ts`. The XML emitter gates
  every `epd24:` block on `hasEpd2024 && features.<X>`.
- **Schema registry**: `SchemaRegistry` (Node fs, used by tests) + inline
  `?raw` Vite imports in Step 1/Step 5 components for the browser. There's no
  `browser-registry.ts` yet — Task 6 may want to create one as the
  `getRegistry()` browser path consolidates.
- **Sample to mimic for XML output**:
  `ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/sample_data/processes/EPDv1.3_example_57a4ae65-d305-421e-b21f-a3f0c35b8abe.xml`
- **Contact sample (with v1.3 entityIds)**:
  `…/sample_data/contacts/9c5cd1fd-7cfa-49ba-a6d3-1f04b55b9e3b.xml`
- **Source sample**:
  `…/sample_data/sources/c0016b33-8cf7-415c-ac6e-deba0d21440d.xml`
- **Reference data**: `C:/indata/Developer_Documentation_ILCD_EPD_1.2_MR7_2023_12_19/EPD_Developer_Docs/EPD_reference_data/ILCD/`
  (27 LCIA method XMLs, full source/contact/flowproperty/unitgroup XMLs from
  the v1.2 bundle). NOT bundled into ZIP per scope decision — validators
  resolve those by UUID.

## Scope decisions that remain in force

- ZIP = process.xml + flow.xml + generated contact/source XMLs from
  user-entered data only. No bundled LCIA-method or unit-group XMLs.
- Round-trip XML import is out of scope.

## Working tree state

```
?? .claude/  (Claude session state, ignore)
   ILCD-EPD-Data-Format-release-v1.3/  (untracked spec source)
M  epd-generator/src/components/steps/Step2ProductInfo.tsx  (Task 4 UI)
M  epd-generator/src/components/steps/Step4Organisations.tsx  (Task 4 UI)
M  epd-generator/src/generators/xml/process-xml.ts  (Tasks 1, 2, 4)
A  epd-generator/src/generators/xml/flow-xml.ts  (Task 3)
A  epd-generator/src/generators/xml/contact-xml.ts  (Task 5)
A  epd-generator/src/generators/xml/source-xml.ts  (Task 5)
M  epd-generator/src/generators/zip-generator.ts  (Tasks 3, 5)
M  epd-generator/src/generators/index.ts  (Tasks 3, 5)
M  epd-generator/src/model/epd-dataset.ts  (Task 4)
M  epd-generator/src/generators/__tests__/process-xml.test.ts
A  epd-generator/src/generators/__tests__/flow-xml.test.ts
A  epd-generator/src/generators/__tests__/zip-generator.test.ts  (Task 5)
M  epd-generator/src/components/steps/Step3ProductFlow.tsx  (Task 6 dropdowns)
M  epd-generator/src/components/steps/Step6Sources.tsx  (Task 6 dropdowns)
M  epd-generator/src/schema/types.ts  (Task 6 BackgroundDatabase)
M  epd-generator/src/schema/indicator-parser.ts  (Task 6 parseBackgroundDbCSV)
M  epd-generator/src/schema/__tests__/indicator-parser.test.ts  (Task 6 tests)
A  epd-generator/src/validation/cross-reference.ts  (Task 7)
A  epd-generator/src/validation/indicator-coverage.ts  (Task 7)
A  epd-generator/src/validation/authoritative-uuids.ts  (Task 7 pure builder)
A  epd-generator/src/schema/browser-registry.ts  (Task 7 ?raw loaders)
M  epd-generator/src/validation/types.ts  (Task 7 ValidationContext)
M  epd-generator/src/validation/validator.ts  (Task 7 context-driven checks)
M  epd-generator/src/validation/__tests__/validator.test.ts  (Task 7 tests)
M  epd-generator/src/components/steps/Step7ReviewExport.tsx  (Tasks 7+8)
M  epd-generator/src/components/ValidatedInput.tsx  (Task 8 id={fieldId})
M  epd-generator/src/components/steps/Step1StandardType.tsx  (Task 8 id alignment)
M  epd-generator/src/components/steps/IndicatorMatrix.tsx  (Task 8 idPrefix)
M  epd-generator/src/components/steps/Step5LifecycleModules.tsx  (Task 8 ids)
A  epd-generator/src/generators/__tests__/e2e-smoke.test.ts  (Task 9)
M  epd-generator/src/components/WizardShell.tsx  (Task 9 unused-import cleanup)
M  epd-generator/src/components/WizardStepIndicator.tsx  (Task 9 cleanup)
M  epd-generator/src/store/epd-store.ts  (Task 9 unused param cleanup)
M  epd-generator/vite.config.ts  (Task 9 vitest defineConfig fix)
A  epd-generator/todos.md
A  epd-generator/HANDOFF.md  (this file)
```

User has not asked for a commit yet. Don't commit unprompted.
