# EPD Generator — Design Specification

## Overview

A schema-driven, client-side React web app that generates valid ILCD+EPD v1.3 datasets through a 7-step wizard. The XSD schemas and authoritative UUID tables from the ILCD-EPD-Data-Format repo are parsed at build time into a TypeScript schema registry that drives form rendering, validation, and XML serialization.

Supports EN 15804+A1, +A2/EF3.0, and +A2/EF3.1. Outputs individual XML files, ILCD ZIP archives, and JSON for integration. Two-tier validation: inline field checks during entry, full XSD + cross-reference validation before export.

## Architecture

Three-layer, all client-side:

```
┌─────────────────────────────────────────────┐
│              Wizard UI (React)              │
│  Multi-step form with inline validation     │
├─────────────────────────────────────────────┤
│           Schema-Driven Engine              │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Schema   │ │ Data     │ │ Validation  │ │
│  │ Registry │ │ Model    │ │ Engine      │ │
│  └──────────┘ └──────────┘ └─────────────┘ │
├─────────────────────────────────────────────┤
│            Output Generators                │
│  ┌─────┐ ┌──────────┐ ┌──────┐ ┌────────┐ │
│  │ XML │ │ ILCD ZIP  │ │ JSON │ │Validate│ │
│  └─────┘ └──────────┘ └──────┘ └────────┘ │
└─────────────────────────────────────────────┘
```

### Schema Registry

Pre-parsed XSD definitions converted to a TypeScript schema model at build time via a Vite plugin. Extracts:

- Field definitions (name, type, constraints, cardinality)
- Namespace mappings (ILCD base, EPD 2013/2019/2024 extensions)
- Enumeration values (EPD subtypes, module names, location codes)

Not a runtime XSD parser — a build step that produces static TypeScript modules.

### Standard Version Configurations

Three configurations, each defining which indicators, namespaces, and features apply:

| Config property | +A1 | +A2 / EF3.0 | +A2 / EF3.1 |
|---|---|---|---|
| Indicator set CSV | `EN15804+A1_indicators.csv` | `EN15804+A2_EF3.0_indicators.csv` | `EN15804+A2_EF3.1_indicators.csv` |
| Indicator count | ~24 | ~35 | ~35 |
| EPD extension namespaces | `epd:2013` | `epd:2013` + `epd2:2019` | `epd:2013` + `epd2:2019` + `epd24:2024` |
| Features | Basic scenarios | + Content declaration, variability | + Service life, SVHC, manufacturers/sites |
| Flow properties CSV | Shared `Flow_properties_and_unit_groups.csv` | Same | Same |
| Common references CSV | Shared `Common_references.csv` | Same | Same |

Adding a new standard version: drop a new indicator CSV, define which namespaces/extensions apply, register it. The wizard auto-adapts.

All authoritative UUIDs (indicators, unit groups, flow properties, background DBs) are loaded from the CSVs at build time into lookup tables. Users never type a UUID manually.

### Data Model

```
EPDDataset
├── meta
│   ├── standardVersion: "+A1" | "+A2/EF3.0" | "+A2/EF3.1"
│   ├── subType: "specific dataset" | "average dataset" | "representative dataset"
│   │            | "generic dataset" | "template dataset"
│   ├── uuid: string (auto-generated)
│   ├── dataSetVersion: string (format "00.01.000")
│   ├── dateOfLastRevision: string (ISO date)
│   └── copyright: boolean
│
├── processInfo
│   ├── name: MultiLangString[]
│   ├── classification: ClassEntry[]
│   ├── generalComment: MultiLangString[]
│   ├── referenceYear: number
│   ├── validUntil: number
│   ├── location: string
│   ├── technologyDescription: MultiLangString[]
│   ├── technologicalApplicability: MultiLangString[]
│   ├── serviceLife: { years, standardRef: Reference, comment: MultiLangString[] }  // +A2
│   ├── scenarios: Scenario[]
│   │   // Scenario: { name, group, default, description: MultiLangString[] }
│   │   // Indicator values reference scenarios by name in module results
│   ├── safetyMargins: { margins: number, description: MultiLangString[] }
│   ├── variability: {                                                        // v1.3
│   │     manufacturerVariability: { type: string, variation: number },
│   │     productVariability: { type: string, variation: number },
│   │     description: MultiLangString[]
│   │   }
│   └── svhc: { present: boolean }                                            // v1.3
│
├── productFlow
│   ├── uuid: string
│   ├── name: MultiLangString[]
│   ├── declaredUnit: { value, flowProperty: Reference, unitGroup: Reference }
│   ├── isA: Reference | null
│   ├── materialProperties: MatMLProperty[]
│   │   // Supported properties: "gross density" (kg/m^3), "bulk density" (kg/m^3),
│   │   //   "grammage" (kg/m^2), "layer thickness" (m), "productiveness" (m^2),
│   │   //   "linear density" (kg/m), "conversion factor to 1 kg" (dimensionless)
│   │   // Each serialized as MatML XML per the Technical Details guide
│   └── contentDeclaration                                                    // +A2
│       ├── components: Component[]
│       │   // Component: { name, weightPerc: RangeValue, materials: Material[] }
│       ├── materials: Material[]
│       │   // Material: { name: MultiLangString[], weightPerc: RangeValue,
│       │   //   mass: RangeValue, CASNumber?, ECNumber?, ddGUID?,
│       │   //   renewable?: number, recycled?: number, recyclable?: number,
│       │   //   packaging?: boolean, substances: Substance[] }
│       └── substances: Substance[]
│           // Substance: { name, weightPerc: RangeValue, CASNumber?, ECNumber?,
│           //   hazardCode?: string, packaging?: boolean }
│           // RangeValue: { value?, lowerValue?, upperValue? }
│
├── quantitativeReference
│   └── referenceToReferenceFlow: number          // dataSetInternalID of the ref flow exchange
│
├── exchanges                                      // LCI indicators (resource use, waste, output flows)
│   └── items: Exchange[]
│       // Exchange: { dataSetInternalID: number (auto-assigned), direction: "Input" | "Output",
│       //   flowRef: Reference, flowPropertyRef: Reference,
│       //   meanAmount: number, module: ModuleName, scenario?: string,
│       //   indicatorUUID: string }
│       // Rows 1-19 of indicator CSVs (PERE, PERM, PERT, PENRE... EEE, EET)
│
├── lciaResults                                    // LCIA impact indicators
│   └── items: LCIAResult[]
│       // LCIAResult: { methodRef: Reference, meanAmount: number,
│       //   module: ModuleName, scenario?: string }
│       // Rows 21+ of indicator CSVs (GWP, AP, EP, ODP, POCP, ADPE, ADPF, etc.)
│
├── organisations
│   ├── manufacturers: Manufacturer[]              // v1.3 rich structure
│   │   // Manufacturer: { contact: Reference, isProvidingData: boolean,
│   │   //   sites: Site[] }
│   │   // Site: { name, facilityIdentifier?, olc?, geoCode?, address? }
│   ├── programmeOperator: Reference
│   ├── lcaConsultant: Reference
│   ├── verifier: Reference
│   └── ownerOfDataSet: Reference
│
├── complianceDeclarations: ComplianceRef[]
│   // ComplianceRef: { system: Reference, overallCompliance: string }
│
├── dataEntryBy
│   ├── timestamp: string
│   └── referenceToDataSetFormat: Reference[]      // ILCD format + EPD extension UUIDs
│
├── publicationAndOwnership
│   ├── dateOfLastRevision: string
│   ├── referenceToOwner: Reference
│   ├── copyright: boolean
│   └── referenceToOriginalEPD: Reference | null   // epd2 namespace
│
├── sources
│   ├── pcr: SourceReference
│   ├── backgroundDatabase: SourceReference
│   ├── epdDocument: SourceReference
│   └── additionalSources: SourceReference[]
│
└── externalDocs: ExternalDoc[]
```

Key design choices:
- `MultiLangString[]` supports en/de and any other language — matches ILCD's `xml:lang` pattern
- **Exchanges vs LCIAResults are separate**: LCI indicators (resource use, waste, output flows from CSV rows 1-19) go into `exchanges`, LCIA impact indicators (CSV rows 21+) go into `lciaResults`. The indicator CSVs have a blank-row separator between the two groups — the build-time parser uses this to classify each indicator.
- `dataSetInternalID` values are auto-assigned sequentially starting from 0. The reference flow exchange's ID is stored in `quantitativeReference.referenceToReferenceFlow`.
- `subType` values include the word "dataset" (e.g. `"average dataset"`) matching the XML enumeration values exactly.
- Scenario names in `processInfo.scenarios` are referenced by exchanges/LCIAResults via optional `scenario` field, enabling per-scenario indicator values.
- The model is standard-version-aware: fields like `serviceLife`, `contentDeclaration`, `svhc`, and the rich `manufacturers` structure are only populated when the selected standard supports them.
- Every reference to another dataset carries a UUID + version + short description, matching ILCD's reference pattern.
- `typeOfDataSet` is always `"EPD"` — hardcoded by the XML generator, not user-entered.
- `exchangeDirection` is determined by the indicator type: resource inputs are `"Input"`, waste/output flows are `"Output"`.

### Country-Specific Indicators

The `Country-specific_indicators.csv` from the repo defines additional indicators used by specific national EPD programmes. These are loaded at build time alongside the standard indicator sets. In the wizard (step 1), after selecting the EN 15804 version, users can optionally select a country profile to include its additional indicators in the lifecycle modules table (step 5). Country-specific indicators appear in a separate section of the indicator matrix.

### Validation Engine

Two tiers:

1. **Inline** — field-level rules derived from XSD constraints (required, type, enum, pattern) checked on blur/change. Runs during wizard entry.
2. **Full** — complete dataset validation before export:
   - XSD structural compliance
   - Cross-reference integrity (every `refObjectId` points to a dataset in the package)
   - Indicator completeness (all required indicators for the selected standard have values for all declared modules)
   - Returns errors with wizard step + field location for click-to-fix navigation

## Wizard Flow

7-step wizard, progressing from general to specific:

| Step | Name | Content |
|------|------|---------|
| 1 | **Standard & Type** | EN 15804 version selection (+A1, +A2/EF3.0, +A2/EF3.1). Optional country-specific indicator profile. EPD subtype (specific dataset, average dataset, representative dataset, generic dataset, template dataset). Drives all subsequent steps. |
| 2 | **Product Info** | Product name (multilingual), classification, declared unit, service life, material properties (gross density, grammage, etc. via MatML). |
| 3 | **Product Flow** | Reference flow definition. "Is-a" hierarchy. Content declaration (components, materials, substances, SVHC, CAS numbers, weight percentages). |
| 4 | **Organisations** | Manufacturer(s) with rich v1.3 structure (contact, sites with facility identifiers/OLC/geo codes, isProvidingData flag). EPD programme operator, LCA consultant, verifier, data owner. Compliance declarations (e.g. DIN EN 15804). Data format references (auto-filled from authoritative UUIDs). |
| 5 | **Lifecycle Modules** | Toggle declared modules (A1, A2, A3, A1-A3, A4, A5, B1-B7, C1-C4, D). Define scenarios (name, group, default flag). Enter indicator values per module — split into two tables: LCI indicators (exchanges: resource use, waste, output flows) and LCIA indicators (impact categories). Indicator tables driven by step 1's standard + country selection. Optional per-scenario values. |
| 6 | **Sources & References** | PCR document, background database (GaBi/ecoinvent with authoritative UUIDs), EPD document, reference to original EPD (if applicable), verification report, technology pictogramme/diagram. Upload external docs (images, PDFs). |
| 7 | **Review & Export** | Read-only summary. Full validation with error/warning distinction. Export as XML, ILCD ZIP, or JSON. Errors block export; warnings allow export with acknowledgement. Error display with click-to-fix navigation back to the relevant step/field. |

UX details:
- Steps navigable non-linearly (click any completed step)
- Step 5 renders a module x indicator matrix, dynamically configured
- Auto-save to localStorage

## Output Generators

### XML Generator
- DOM-based XML construction with correct namespace declarations:
  - `http://lca.jrc.it/ILCD/Process` (base)
  - `http://lca.jrc.it/ILCD/Common` (common)
  - `http://www.iai.kit.edu/EPD/2013` (epd)
  - `http://www.indata.network/EPD/2019` (epd2)
  - `http://www.indata.network/EPD/2024` (epd24)
- Namespaces included driven by standard version
- Generates all linked datasets: Flow XML, Contact XMLs, Source XMLs, UnitGroup XMLs, FlowProperty XMLs
- Includes `xsi:schemaLocation` and `<?xml-stylesheet?>` processing instruction

### ILCD ZIP Generator
- JSZip with correct folder structure:
  ```
  ILCD/
  ├── processes/
  ├── flows/
  ├── contacts/
  ├── sources/
  ├── flowproperties/
  ├── unitgroups/
  ├── lciamethods/
  └── external_docs/
  ```
- Only includes folders with actual content

### JSON Generator
- Direct serialization of the `EPDDataset` model
- Indicator values keyed by human-readable short names alongside UUIDs
- Integration format for external tools (e.g. CarbonConstruct)

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React + TypeScript | Type safety for complex data model |
| Build | Vite | Fast dev, custom plugin for XSD/CSV build-time processing |
| Styling | Tailwind CSS | Utility-first, fast form development |
| Form state | Zustand | Lightweight, localStorage persistence |
| XML handling | xmldom + custom serializer | DOM-based with namespace support, client-side |
| ZIP | JSZip | Mature client-side ZIP generation |
| XSD validation | Custom validation engine from parsed XSD constraints | Full schema validation in-browser |
| Routing | React Router | Wizard step navigation with URL state |
| Deployment | Vercel | Zero-config deploys |
| Testing | Vitest | Fast, Vite-native |

## Testing Strategy

### 1. Schema Registry Tests
- Verify build-time XSD parser extracts correct field definitions, types, constraints
- Assert all three indicator CSVs parse with valid UUIDs and correct counts
- Snapshot tests on generated TypeScript registry

### 2. Round-Trip Tests
- Use `EPDv1.3_example_57a4ae65-d305-421e-b21f-a3f0c35b8abe.xml` as primary test fixture (most complete, real UUIDs)
- `sample_EPD.xml` used for structural coverage but excluded from exact-diff tests (contains placeholder UUIDs)
- Load sample XML → parse into `EPDDataset` → re-serialize to XML → structural comparison (element/attribute presence and values, ignoring whitespace/ordering)
- Validates data model completeness and XML generator correctness
- JSON export → re-import → XML export → should match structurally

### 3. Validation Tests
- Intentionally broken datasets → assert correct error detection with field locations
- Valid sample data → assert zero errors
- Cross-reference checks: orphaned refs, missing properties, incomplete indicator matrices

Sample data from `sample_data/` serves as the test fixture library.

## Scope Boundaries

### In Scope
- Creating new EPD datasets from scratch via the wizard
- All three EN 15804 standard versions
- Country-specific indicator profiles
- XML, ILCD ZIP, and JSON export
- Two-tier validation (inline + full pre-export)
- Auto-save/restore via localStorage

### Out of Scope (Future)
- Importing/editing existing ILCD+EPD XML or ZIP archives (the data model and parser infrastructure will exist from round-trip tests, but no import UI in v1)
- soda4LCA REST API integration for direct database submission
- Multi-user collaboration or cloud storage
- PDF/HTML human-readable EPD report generation

## Accessibility

- Keyboard navigation through all wizard steps and form fields
- ARIA labels on all form controls, especially the indicator matrix tables
- Focus management on step transitions and error navigation
- Sufficient color contrast for validation error/warning states
