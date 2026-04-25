# EPD Generator — gap closure todo list

Companion to `docs/superpowers/specs/2026-04-07-epd-generator-design.md` and the approved plan at `~/.claude/plans/with-the-gaps-and-declarative-orbit.md`. Goal: take the generator from "scaffold complete" to **producing valid, complete v1.3 XML and a usable ILCD ZIP** for +A2/EF3.1 (with +A1 / +A2/EF3.0 still working as subsets).

**Scope decisions:**
- ZIP = `process.xml` + real `flow.xml` (with MatML + flowProperties) + generated contact/source XMLs from user-entered data. No bundled LCIA/unit-group XMLs from v1.2 reference data.
- Round-trip XML import is out of scope.

**Reference points:**
- Sample to mimic: `ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/sample_data/processes/EPDv1.3_example_57a4ae65-d305-421e-b21f-a3f0c35b8abe.xml`
- Sample flow with MatML: `…/sample_data/flows/a7432abd-0881-4977-a817-f8aaf627fb91.xml`
- Sample contact (v1.3 entityIds): `…/sample_data/contacts/9c5cd1fd-7cfa-49ba-a6d3-1f04b55b9e3b.xml`
- v1.2 → v1.3 changes: `…/doc/guides/EPD Data Format – Migration Guide from 1.2 to 1.3.md`

---

## Tasks

- [x] **0. Create this file** — copy the plan task list here so progress is visible alongside the code.

- [x] **1. Fix v1.3 namespace/casing bugs in `process-xml.ts`** ✓ done
  - SVHC: now `<epd24:SVHC epd24:present="…"/>`, gated on `hasEpd2024`
  - Variability: moved to `<epd24:variability>` with `epd24:` children, including the previously-skipped `epd24:variationRange` attribute and `epd24:variabilityDescription` multilang elements; gated on `hasEpd2024`
  - 4 new tests added; all 84 tests pass

- [x] **2. Emit `epd2:contentDeclaration` in `process-xml.ts`** ✓ done
  - New helpers: `renderRangeValue`, `renderSubstance`, `renderMaterial`, `renderComponent`, `renderContentDeclaration`. Top-level structure (component / material / substance) follows the XSD `xs:choice` exactly, so any combination is supported. `RangeValue` emits as `epd2:value` / `epd2:lowerValue` / `epd2:upperValue` attributes. Material/substance attributes (CAS/EC/hazardCode/renewable/recycled/recyclable/packaging/ddGUID) emitted only when present.
  - Wired into `dsiOtherParts` next to SVHC, gated on `features.contentDeclaration && hasEpd2019`
  - 6 new tests added (full+component+range+omitted-on-A1+enabled-on-EF3.0+undefined-skip); all 90 tests pass

- [x] **3. Build a real Flow XML generator and replace the ZIP stub** ✓ done
  - New `src/generators/xml/flow-xml.ts` (~165 lines) with `generateFlowXML(dataset)`. Emits `<flowDataSet>` (Flow as default ns, `common:` prefix), `<common:UUID>`, multilingual `<baseName>`, `<typeOfDataSet>Product flow</typeOfDataSet>`, `<referenceToReferenceFlowProperty>0</…>`, `<flowProperty dataSetInternalID="0">` from `declaredUnit.flowPropertyRef`, and timestamp/version from the parent dataset.
  - MatML emission: groups properties by `materialName` so each material gets its own `<mat:BulkDetails>`. `<mat:Metadata>` declares one `<mat:PropertyDetails>` per unique property name used. Property→ID mapping: pr1=gross density, pr2=grammage, pr3=bulk density, pr4=layer thickness, pr5=productiveness, pr6=linear density, pr7=conversion factor to 1 kg.
  - `zip-generator.ts` simplified — `buildFlowXML` stub deleted, calls `generateFlowXML(dataset)` directly. `generators/index.ts` exports the new function.
  - Cleanup: removed unused `Reference` type import from `process-xml.ts` (was unused pre-Task-3, surfaced once `tsc -b` was rerun).
  - 10 new tests; 100 total tests pass. Pre-existing TS errors (React/`get` unused, vite.config overload) noted for Task 9.

- [x] **4. Emit the rich `epd24:` v1.3 fields in `process-xml.ts`** ✓ done
  - **Model** (`src/model/epd-dataset.ts`): added `ProductId`, `UseConditionFactor`, `ServiceLife` (replaces old shallow shape), `CollectionFractions`/`RecoveryFractions`/`DisposalFractions`/`EolScenarioData`/`UseStageScenarioData`/`ScenarioData`, `PCRCompliance`. New optional `processInfo` fields: `productIds`, `estimatedServiceLife`, `scenarioData`, `pcrCompliance`. `serviceLife` extended with `useConditionFactors[]`, `useConditionsDocumentationRef?`, optional `standardRef`.
  - **XML emitter** (`src/generators/xml/process-xml.ts`):
    - New helpers: `renderProductIds`, `renderUseConditionFactor`, `renderServiceLife` (handles both `referenceServiceLife` and `estimatedServiceLife` via tag-name parameter), `renderEolScenarioData`, `renderScenarioData`, `renderSite`, `renderManufacturer`, `renderManufacturers`, `renderPcrCompliance`.
    - `dsiOtherParts` now also accumulates productIds, referenceServiceLife, estimatedServiceLife, scenarioData (each gated on `hasEpd2024 && features.*`).
    - `expirationDateOfEPD` moved from `epd2:` to `epd24:` namespace, emitted inside `<time>/<common:other>` (was a wrong-namespace bug).
    - `LCIMethodAndAllocation/<common:other>` consolidated: subType + variability + pcrCompliance share one block (matches sample structure).
    - `dataSourcesTreatmentAndRepresentativeness/<common:other>` consolidated: manufacturers in one block.
    - Fixed manufacturer rendering: now emits `<epd24:manufacturer epd24:isProvidingData="…">` with nested `<epd24:contact>` (was `<epd24:referenceToManufacturer>`) and `<epd24:sites><epd24:site>` with name/facilityIdentifier/olc/geoCode/streetAddress.
    - Side-fix: scenarios and safetyMargins now use the correct `epd:` prefix (was emitting `epd2:` with broken namespace).
  - **Minimum-viable UI**:
    - `Step2ProductInfo.tsx`: added expiration-date input and a productIds add/remove table; both gated on `features.serviceLife` / `features.productIds`.
    - `Step4Organisations.tsx`: added a sites manager under the manufacturer card (name, facility identifier, geo code, OLC, street address) gated on `features.manufacturers`.
  - **Tests**: 15 new tests (productIds enabled/disabled, referenceServiceLife with use-condition factors + comments + standard refs, estimatedServiceLife alongside reference, service-life omission on +A2/EF3.0, scenarioData with useStage + multiple EoL scenarios, scenarioData omission on +A2/EF3.0, expirationDateOfEPD in epd24 ns, expirationDateOfEPD omission, manufacturer with full sites, manufacturer without sites, manufacturers omission, pcrCompliance, pcrCompliance omission, single common:other in LCIMethodAndAllocation). 115/115 tests pass.
  - **Known follow-ups out of Task 4 scope**: `referenceToOriginalEPD` and `referenceToPublisher` are still emitted in `publicationAndOwnership` but the v1.3 sample places them in `dataSourcesTreatmentAndRepresentativeness/common:other` and uses different element names (`epd2:referenceToPublisher` instead of `common:referenceToUnchangedRepublication`). Worth fixing alongside Task 5 or Task 9 cleanup.

- [x] **5. Generate Contact and Source XMLs and bundle them into the ZIP** ✓ done
  - New `src/generators/xml/contact-xml.ts` (~37 lines) — `generateContactXML(ref, dataset)` emits a minimal `<contactDataSet>` (default ns `NS.CONTACT`, `common:` prefix). Body: `<common:UUID>`, `<common:shortName>` and `<common:name>` per language from `ref.shortDescription`, `<classificationInformation>` with default `Organisations` class, `<administrativeInformation>` with `<common:timeStamp>` from `dataset.dataEntryBy.timestamp` and `<common:dataSetVersion>` from `ref.version` else `'00.01.000'`. Reuses `xmlEscape` and `renderMultiLang` from `xml-utils`.
  - New `src/generators/xml/source-xml.ts` (~36 lines) — `generateSourceXML(ref, dataset)` mirrors the contact shape with `<sourceDataSet>` (default ns `NS.SOURCE`), default `Other source types` class, no `sourceDescriptionOrComment` (not in model). v1.3 entityIds deferred — model doesn't carry them.
  - `zip-generator.ts` rewritten (~75 lines): added `dedupe()` plus `collectUserContacts(d)` and `collectUserSources(d)` walkers. Contacts walked: `organisations.manufacturers[].contact`, `commissioner`, `dataGenerator`, `programmeOperator`, `verifier`, `ownerOfDataSet`, `publicationAndOwnership.{referenceToOwner|referenceToPublisher|registrationAuthority}`. Sources walked: `processInfo.serviceLife.{standardRef|useConditionsDocumentationRef}`, same on `estimatedServiceLife`, `sources.{pcr|backgroundDatabases[]|epdDocument|dataHandlingPrinciples|technologyPicture|technologyFlowDiagram|additionalSources[]}`, `publicationAndOwnership.referenceToOriginalEPD`. Skipped (authoritative): `complianceDeclarations[].system`, `dataEntryBy.referenceToDataSetFormat[]`, all flow/unit-group/LCIA-method refs. Empty `refObjectId` filtered; folders only created when refs exist.
  - `generators/index.ts`: exports added for `generateContactXML` and `generateSourceXML`.
  - 10 new tests in `src/generators/__tests__/zip-generator.test.ts` (process+flow paths, contact emission, source emission, dedupe, empty-refObjectId skip, authoritative skip, contact XML shape, source XML shape, multilingual shortNames, version fallback). 125/125 tests pass.
  - **Known follow-ups**: contact `entityIds` (VATID/EC_ORG_ID/TIN/openEPD) not yet in the data model; default classifications are minimal one-liners (we don't capture per-contact/per-source classification in the wizard); `referenceToOriginalEPD` and `referenceToPublisher` placement bug noted in Task 4 follow-ups still applies.

- [x] **6. Replace hardcoded UUIDs with registry-driven dropdowns** ✓ done
  - **Schema layer**: added `BackgroundDatabase` interface and `BackgroundDbProvider = 'GaBi' | 'ecoinvent'` to `src/schema/types.ts`. New `parseBackgroundDbCSV(csv, provider)` in `src/schema/indicator-parser.ts` — handles both GaBi (3-col) and ecoinvent (4-col with empty version) variants since both share `version, name, UUID` in cols 0–2; quoted commas in `"Edition 2020, CUP 2020.02"`-style names handled by existing `parseCSVLine`.
  - **Step 3** (`Step3ProductFlow.tsx`): killed the 5 hardcoded `DECLARED_UNIT_OPTIONS`. Now loads `Flow_properties_and_unit_groups.csv` via `?raw` import (matching Step 1/Step 5 pattern), parses with `parseFlowPropertiesCSV`, and `buildDeclaredUnitOptions` filters to entries that have BOTH `flowPropertyUuid` AND `referenceUnitGroupUuid` AND `referenceUnit` (skips entries without unit groups). Yields 11 options (Mass, Volume, Area, Length, Number of items, Gross calorific value, Net calorific value, Mass*time, Area*time, Volume*time, Radioactivity) — verified live in dev server.
  - **Step 6** (`Step6Sources.tsx`): killed `'ecoinvent-placeholder-uuid-…'`. Loads `BackgroundDB_SourceDatasets_GaBi.csv` and `BackgroundDB_SourceDatasets_ecoinvent.csv` via `?raw`, renders as two `<optgroup>`s ("GaBi / Sphera MLC", "ecoinvent"). Yields 24 GaBi + 17 ecoinvent = 41 real options — verified live; CSV row counts match.
  - **Compliance UUID sanity check**: `STANDARD_CONFIGS['+A2/EF3.1'].complianceRef.uuid` (`d4aa3ec7-b1d7-4a4a-a6cb-37af88dcc902`) IS in `Common_references.csv` line 8 — todos.md note about it being absent was stale. No change needed; `standard-configs.ts` left untouched.
  - **Tests**: 8 new tests in `src/schema/__tests__/indicator-parser.test.ts` (GaBi: provider tag, "general" UUID `28d74cc0-…`, Sphera MLC quoted-comma row; ecoinvent: provider tag, "general" UUID `b497a91f-…`, version 3.10 UUID `6edab576-…`). 133/133 tests pass.
  - **Live verification**: started Vite dev server, navigated to Step 3 (`select#declaredUnit` shows 12 options including placeholder, all UUIDs come from CSV), Step 6 (`select#backgroundDb` shows 2 optgroups with 24+17 options, selecting "GaBi Database (general)" writes UUID `28d74cc0-…` to the store). No console errors.
  - **Known follow-up**: a shared `browser-registry.ts` consolidating all `?raw` CSV imports could be created in a future task — currently each step that needs CSV data inlines its own imports.

- [x] **7. Cross-reference and indicator-completeness validation** ✓ done
  - **New `src/validation/cross-reference.ts`**: `walkReferences(d)` walks every `Reference` in the EPDDataset (28 distinct fields covering processInfo/productFlow/exchanges/lciaResults/organisations/complianceDeclarations/dataEntryBy/publicationAndOwnership/sources) emitting `(ref, field-path, step)` triples. `findUnresolvedReferences(dataset, { bundled, authoritative })` warns when `refObjectId` is non-empty but found in neither set. Empty `refObjectId`s skipped (handled by required-field validation elsewhere). Step mapping: processInfo→2, productFlow→3, exchanges/lciaResults→5, organisations/compliance/dataEntryBy→4, publicationAndOwnership/sources→6.
  - **`getBundledUuids(dataset)`** (also in cross-reference.ts): returns Set of UUIDs that will be in the ZIP — process, flow, plus user-entered contact + source UUIDs (mirrors zip-generator.ts collector logic). Excludes authoritative refs (compliance system, dataSetFormat, all flow/unit-group/LCIA-method refs).
  - **New `src/validation/indicator-coverage.ts`**: `findIndicatorCoverageGaps(dataset, lciaIndicators)` walks `declaredModules × lciaIndicators` and warns once per missing `(module, indicator)` cell. Builds a `Map<methodUuid, Set<module>>` from `dataset.lciaResults` for O(1) lookup. Field-path format: `lciaResults.<indicatorUuid>.<module>` so the future click-to-fix wiring (Task 8) can deep-link. Step always 5.
  - **New `src/validation/authoritative-uuids.ts`** (pure builder): `buildAuthoritativeUuids(catalogue)` constructs the Set from `CommonReference[]`, `FlowProperty[]` (both flowProp + unitGroup UUIDs), `BackgroundDatabase[]`, `Indicator[]` (both indicator + unitGroup UUIDs), and `CountryIndicator[]`. No `?raw` imports — safe for vitest.
  - **New `src/schema/browser-registry.ts`**: browser-only loader with `?raw` imports for all 8 identifier CSVs (3 indicator versions, country, common refs, flow properties, GaBi, ecoinvent). Exports `loadAuthoritativeUuids(version)` and `loadLciaIndicators(version)` that pick the right indicator CSV per standard version. Step 7 wires both via `useMemo`. Initial split mistake: tried to inline `?raw` into authoritative-uuids.ts, which broke vitest with "Denied ID" because vitest evaluates `?raw` imports even if only the pure builder is used; splitting fixed it.
  - **`src/validation/types.ts`**: added `ValidationContext` ({ authoritativeUuids?, lciaIndicators? }).
  - **`src/validation/validator.ts`**: now accepts optional `context`. Without context: legacy behavior unchanged (the existing 5 tests still pass). With context: appends cross-ref + indicator-coverage warnings.
  - **`Step7ReviewExport.tsx`**: passes `loadAuthoritativeUuids(standardVersion)` and `loadLciaIndicators(standardVersion)` into `validateDataset`. Validation panel now shows cross-ref + indicator-coverage warnings live.
  - **Tests**: 15 new tests in `validator.test.ts` (4 for `getBundledUuids` — process/flow always included, user-entered contacts/sources included, authoritative refs excluded; 5 for `findUnresolvedReferences` — bogus compliance UUID warned, known authoritative compliance UUID `d4aa3ec7-…` resolved, known flow property UUID `93a60a56-…` resolved, empty refObjectIds skipped; 4 for `findIndicatorCoverageGaps` — empty modules→0 issues, full grid `2 modules × 19 indicators = 38` warnings, partial coverage skips filled cells, per-module independence; 2 for `validateDataset` end-to-end with context).
  - **Live verification**: Step 7 panel rendered 19 indicator-coverage warnings on an empty dataset with `A1-A3` declared (matches EF3.1 LCIA indicator count of 19). All 25 issues showed correctly with step + field-path + message. No console errors.
  - **Final test count**: 148/148 tests pass.

- [x] **8. Click-to-fix navigation in the validation panel** ✓ done
  - **`Step7ReviewExport.tsx`**: validation panel issue rows are now `<button>` elements with `aria-label="Go to step <n> and fix <field>"`. Click handler calls `setStep(issue.step - 1)` (validator is 1-indexed; wizard `currentStep` is 0-indexed) then runs `focusIssueField(field)`. Buttons inherit the surrounding red/yellow palette and add hover/focus rings (`hover:bg-red-100`, `focus:ring-red-400`; same in yellow). Errors and warnings both clickable.
  - **`focusIssueField` polling helper** (also in Step 7): the new step component takes a few frames to mount in dev mode (Vite HMR + memoised selectors + the indicator-CSV `loadAuthoritativeUuids` recompute on standard-version dependency). Initial `setTimeout(80)` was too short — focus landed back on `<body>`. Replaced with a `requestAnimationFrame` polling chain (up to 20 frames, ~330ms) that retries until `getElementById(fieldId)` resolves, then calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` and `el.focus({ preventScroll: true })` if the target is an input/textarea/select.
  - **`ValidatedInput.tsx`**: `<input>`/`<textarea>` now get `id={fieldId}` automatically (matches the prop name already used to look up `FIELD_RULES`). Also added `htmlFor={fieldId}` on the `<label>`. This single change makes `processInfo.name` and `processInfo.referenceYear` deep-linkable for free.
  - **Plain-input id renames** (validator-path alignment):
    - `Step1StandardType.tsx`: `<fieldset id="meta.standardVersion">` on the radio group
    - `Step2ProductInfo.tsx`: location input renamed `id="location"` → `id="processInfo.location"`
    - `Step3ProductFlow.tsx`: flow name renamed `id="flowNameEn"` → `id="productFlow.name"`
    - `Step5LifecycleModules.tsx`: `<div id="declaredModules">` around the module-toggle row, `<div id="exchanges">` and `<div id="lciaResults">` around the two main matrices
    - `Step6Sources.tsx`: `id="sources.pcr"` on the PCR card
  - **`IndicatorMatrix.tsx`**: new optional `idPrefix?: string` prop. When set, each cell `<input>` gets `id={\`${idPrefix}.${indicator.uuid}.${module}\`}`. Step 5 passes `idPrefix="exchanges"` to the LCI matrix and `idPrefix="lciaResults"` (matching the indicator-coverage validator path) to the LCIA + country-LCIA matrices. This makes every cell deep-linkable from a Task 7 indicator-coverage warning.
  - **Tests**: no new tests added — focus/scroll behavior is genuinely browser-only (jsdom doesn't implement scrollIntoView meaningfully). All 148 existing tests still pass.
  - **Live verification**:
    - Click `Go to step 2 and fix processInfo.name`: wizard jumps to Step 2 ("Product Info"), focused element id = `processInfo.name`, INPUT, visible in viewport (top 189, bottom 208).
    - Click `Go to step 5 and fix lciaResults.a7ea142a-9749-11ed-a8fc-0242ac120002.A1-A3` (GWP-total): wizard jumps to Step 5 ("Lifecycle Modules"), focused element id matches the deep path, aria-label = "GWP-total A1-A3", visible in viewport.
    - 25 issue buttons rendered on a default `+A2/EF3.1` dataset (5 generic warnings + 1 error + 19 indicator-coverage gaps).
  - **Known follow-up for Task 9 cleanup**: a few field paths still don't have matching DOM ids — `complianceDeclarations[<n>].system`, `dataEntryBy.referenceToDataSetFormat[<n>]`, `productFlow.declaredUnit.flowPropertyRef`, all `publicationAndOwnership.*` refs, `sources.{epdDocument|backgroundDatabases[...]|...}`, all `processInfo.{serviceLife|estimatedServiceLife}.*Ref` paths. The polling helper handles missing ids gracefully (just navigates to the step without scrolling). Adding these is straightforward when those forms grow more inputs.

- [x] **9. End-to-end smoke test** ✓ done
  - **`npx vitest run`**: 12 files, 152 tests, all pass.
  - **`npm run build`**: clean TS build (after fixing the 5 pre-existing TS errors flagged in HANDOFF). Production bundle: `index-*.js` 188.35 kB / 59.70 kB gzipped, lazy chunks per step ranging 1.7–6.9 kB.
  - **TS-error cleanup** (was tracked as Task 9 cleanup):
    - Removed unused `import React` from `WizardShell.tsx`, `WizardStepIndicator.tsx`, `Step6Sources.tsx` (modern JSX transform doesn't need it).
    - Removed unused `get` parameter from `epd-store.ts` Zustand factory.
    - `vite.config.ts`: switched `defineConfig` import from `'vite'` to `'vitest/config'` so the `test:` field overload type-checks. Triple-slash reference alone wasn't enough; the official path is the dedicated import.
  - **End-to-end vitest smoke** (new file `src/generators/__tests__/e2e-smoke.test.ts`): builds a fully-populated `+A2/EF3.1` dataset (full processInfo with serviceLife + scenarioData + productIds + variability + pcrCompliance + svhc, productFlow with MatML, all 6 declared modules `A1-A3 + C1 + C2 + C3 + C4 + D`, all 19 LCIA indicators × 6 modules = 114 result entries, manufacturers with sites, verifier/programmeOperator/dataGenerator/owner/publisher/registrationAuthority contacts, EN 15804+A2 (EF 3.1) compliance, ILCD format reference, PCR + GaBi general background DB + EPD doc + ISO 15686-7 service-life standard ref) and runs four assertions:
    1. Process XML has all 10 major v1.3 `epd24:` blocks (productIds, referenceServiceLife, scenarioData, eolScenarioData, manufacturers, site, pcrCompliance, SVHC, variability, expirationDateOfEPD).
    2. ZIP folder structure: 1 process file, 1 flow file, exactly **7 contact files** (mfr, dataGenerator, programmeOperator, verifier, owner, publisher, registrationAuthority — verified by exact-set assertion; note `ownerOfDataSet` and `referenceToOwner` share `owner-uuid` so the dedupe collapses to one file), exactly **5 source files** (PCR, GaBi general, EPD doc, ISO 15686-7, use-conditions doc).
    3. **Referential integrity**: scrape every `refObjectId="…"` from process.xml, assert each one resolves to a bundled ZIP file OR a UUID present in `Common_references.csv` / `Flow_properties_and_unit_groups.csv` / both background-DB CSVs / the indicator CSVs / the country-indicator CSV. Zero unresolved refs.
    4. `validateDataset(dataset, { authoritativeUuids, lciaIndicators })` returns `valid: true`, zero errors, zero unresolved-ref warnings, zero indicator-coverage gaps.
  - **Live browser smoke**: drove the production Vite bundle in the preview server. Initial empty dataset gates exports (Export buttons all disabled with "Errors — export is disabled until these are resolved: processInfo.name"). Clicked the click-to-fix button to jump to Step 2, typed "Smoke Test Wood Panel" into the focused input — error cleared, all three Export buttons (XML, ILCD ZIP, JSON) unlocked. Clicked "Export ILCD ZIP" → status banner reads "ILCD ZIP exported successfully", no runtime errors in console (the historical HMR errors visible in the buffer are stale Task-7-refactor artifacts that were never cleared, not new errors from this run).
  - **Final test count**: 152/152 tests pass (148 baseline + 4 new e2e-smoke tests).
  - **Stretch (ILCD Validation Tool)**: not run — would require running `ilcdvalidationtool` against an exported sample. The internal cross-ref + indicator-coverage validator (Task 7) reproduces the most common failure modes that tool catches (unbundled UUIDs, missing module values), so the smoke test gives high confidence even without the external tool.

---

## Open follow-ups (out of scope for the original 9-task plan)

These came up during the work and are explicitly deferred:

- **Australia / Oceania country-specific indicators**: the Step 1 country dropdown only lists Finland/Norway/Sweden/Germany because that's all that's in the upstream `doc/identifiers/Country-specific_indicators.csv`. Adding AU/NZ requires either (a) finding officially-registered indicator UUIDs from EPD Australasia or an Australian PCR — fabricating UUIDs would break Task 7's cross-reference validation against real ILCD validators — or (b) submitting a PR to the upstream spec at https://github.com/Inwistand/ILCD-EPD-Data-Format. **User wants option (b)** — pursue after this 9-task plan completes.
- **`referenceToOriginalEPD` / `referenceToPublisher` placement** (Task 4 follow-up): currently emitted inside `publicationAndOwnership` but the v1.3 sample places them in `dataSourcesTreatmentAndRepresentativeness/common:other` and uses `epd2:referenceToPublisher` instead of `common:referenceToUnchangedRepublication`. Fix when next touching publication metadata.
- **Contact `entityIds`** (Task 5 follow-up): VATID/EC_ORG_ID/TIN/openEPD entityIds are in the v1.3 contact sample but not yet captured in the data model or emitted by `contact-xml.ts`.
- **Per-contact / per-source classifications** (Task 5 follow-up): `contact-xml.ts` and `source-xml.ts` emit a single hardcoded default class — the wizard doesn't capture classification per organisation or source.
- **Browser registry consolidation** (Task 6 hint): each step that needs CSV data inlines its own `?raw` imports. A consolidated `src/schema/browser-registry.ts` (already created in Task 7 for indicator CSVs) could absorb the Step 3 / Step 6 loaders too.
- **Click-to-fix coverage** (Task 8 follow-up): several reference paths still lack matching DOM ids — `complianceDeclarations[<n>].system`, `dataEntryBy.referenceToDataSetFormat[<n>]`, all `publicationAndOwnership.*` refs, all `processInfo.serviceLife.*Ref` paths, every `sources.*` field except `sources.pcr`. The polling helper handles missing ids gracefully (just navigates to the step without scrolling).
