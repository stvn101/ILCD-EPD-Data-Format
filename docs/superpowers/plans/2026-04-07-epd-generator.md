# EPD Generator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a schema-driven web app that generates valid ILCD+EPD v1.3 XML datasets through a 7-step wizard, supporting EN 15804+A1, +A2/EF3.0, and +A2/EF3.1 standards.

**Architecture:** Three-layer client-side app: Wizard UI (React) → Schema-Driven Engine (registry, data model, validation) → Output Generators (XML, ZIP, JSON). XSD schemas and indicator CSVs are parsed at build time into TypeScript modules. The schema registry drives form rendering, validation rules, and XML serialization.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Zustand, xmldom, JSZip, Vitest, React Router, deployed to Vercel.

**Spec:** `docs/superpowers/specs/2026-04-07-epd-generator-design.md`

**Reference data location:** `ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/` (nested directory) contains all XSD schemas, indicator CSVs, sample XMLs, and documentation.

**Important notes:**
- The working directory is `C:/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/` — this is NOT a git repo, so `git init` is needed first.
- The actual data lives in a nested subdirectory: `ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/` etc.
- The SchemaRegistry uses Node `fs` for tests only. For the browser app, a Vite plugin copies CSV data into importable TypeScript at build time (Task 3b).

---

## Chunk 1: Project Scaffold & Schema Registry

### Task 1: Initialize Vite + React + TypeScript Project

**Files:**
- Create: `epd-generator/package.json`
- Create: `epd-generator/vite.config.ts`
- Create: `epd-generator/tsconfig.json`
- Create: `epd-generator/tsconfig.node.json`
- Create: `epd-generator/index.html`
- Create: `epd-generator/src/main.tsx`
- Create: `epd-generator/src/App.tsx`
- Create: `epd-generator/tailwind.config.js`
- Create: `epd-generator/postcss.config.js`
- Create: `epd-generator/src/index.css`

- [ ] **Step 1: Create project directory and initialize**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3
mkdir epd-generator && cd epd-generator
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npm install
npm install zustand react-router-dom jszip uuid
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @types/uuid
```

- [ ] **Step 3: Configure Tailwind**

In `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

In `postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Vitest**

Add to `vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
});
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Create minimal App shell**

Replace `src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">EPD Generator</h1>
          <p className="text-sm text-gray-500">ILCD+EPD v1.3 Dataset Creator</p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <p>Wizard will go here</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Verify it runs**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npm run dev
```

Expected: Dev server starts, browser shows "EPD Generator" heading.

- [ ] **Step 7: Verify tests work**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run
```

Expected: 0 tests, no errors.

- [ ] **Step 8: Initialize git and commit**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3
git init
echo "node_modules/\ndist/\n.DS_Store" > .gitignore
git add epd-generator/ .gitignore
git commit -m "feat: initialize EPD generator project with Vite + React + TypeScript + Tailwind"
```

---

### Task 2: Build Indicator CSV Parser

**Files:**
- Create: `epd-generator/src/schema/indicator-parser.ts`
- Create: `epd-generator/src/schema/types.ts`
- Test: `epd-generator/src/schema/__tests__/indicator-parser.test.ts`

- [ ] **Step 1: Define schema types**

Create `src/schema/types.ts`:
```ts
export type StandardVersion = '+A1' | '+A2/EF3.0' | '+A2/EF3.1';

export type IndicatorCategory = 'exchange' | 'lcia';

export interface Indicator {
  uuid: string;
  version: string;
  nameEn: string;
  unitEn: string;
  unitGroupUuid: string;
  nameDe: string;
  unitDe: string;
  category: IndicatorCategory; // 'exchange' for LCI rows, 'lcia' for impact rows
}

export interface IndicatorSet {
  standardVersion: StandardVersion;
  exchanges: Indicator[];  // LCI indicators (rows before blank line)
  lcia: Indicator[];       // LCIA impact indicators (rows after blank line)
  all: Indicator[];        // combined for convenience
}

export interface FlowProperty {
  name: string;
  uuid: string;
  version: string;
  referenceUnit: string;
  unitGroupName: string;
  unitGroupUuid: string;
}

export interface CommonReference {
  name: string;
  datasetType: string;
  uuid: string;
  version: string;
}

export interface CountryIndicator extends Indicator {
  countries: string[];
}

export type ModuleName =
  | 'A1' | 'A2' | 'A3' | 'A1-A3'
  | 'A4' | 'A5'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'D';

export type EPDSubType =
  | 'specific dataset'
  | 'average dataset'
  | 'representative dataset'
  | 'generic dataset'
  | 'template dataset';

export interface MultiLangString {
  lang: string;
  value: string;
}

export interface Reference {
  type: string;       // e.g. 'source data set', 'contact data set', 'flow data set'
  refObjectId: string; // UUID
  version?: string;
  uri?: string;
  shortDescription: MultiLangString[];
}
```

- [ ] **Step 2: Write failing test for indicator CSV parsing**

Create `src/schema/__tests__/indicator-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseIndicatorCSV } from '../indicator-parser';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3');

describe('parseIndicatorCSV', () => {
  it('parses EN15804+A1 indicators into exchanges and lcia', () => {
    const csv = readFileSync(
      resolve(REPO_ROOT, 'doc/identifiers/EN15804+A1_indicators.csv'),
      'utf-8'
    );
    const result = parseIndicatorCSV(csv, '+A1');

    // A1 has 18 exchange indicators (PERE through EET) and 7 LCIA indicators (GWP through ADPF)
    expect(result.exchanges.length).toBe(18);
    expect(result.lcia.length).toBe(7);
    expect(result.all.length).toBe(25);
    expect(result.standardVersion).toBe('+A1');

    // Check first exchange indicator
    expect(result.exchanges[0].uuid).toBe('20f32be5-0398-4288-9b6d-accddd195317');
    expect(result.exchanges[0].nameEn).toContain('PERE');
    expect(result.exchanges[0].category).toBe('exchange');

    // Check first LCIA indicator
    expect(result.lcia[0].uuid).toBe('77e416eb-a363-4258-a04e-171d843a6460');
    expect(result.lcia[0].nameEn).toContain('GWP');
    expect(result.lcia[0].category).toBe('lcia');
  });

  it('parses EN15804+A2 EF3.0 indicators', () => {
    const csv = readFileSync(
      resolve(REPO_ROOT, 'doc/identifiers/EN15804+A2_EF3.0_indicators.csv'),
      'utf-8'
    );
    const result = parseIndicatorCSV(csv, '+A2/EF3.0');

    expect(result.exchanges.length).toBe(18);
    expect(result.lcia.length).toBe(19);
    expect(result.standardVersion).toBe('+A2/EF3.0');
  });

  it('parses EN15804+A2 EF3.1 indicators', () => {
    const csv = readFileSync(
      resolve(REPO_ROOT, 'doc/identifiers/EN15804+A2_EF3.1_indicators.csv'),
      'utf-8'
    );
    const result = parseIndicatorCSV(csv, '+A2/EF3.1');

    expect(result.exchanges.length).toBe(18);
    expect(result.lcia.length).toBe(19);
    expect(result.standardVersion).toBe('+A2/EF3.1');

    // Check GWP-total is present (A2-specific)
    const gwpTotal = result.lcia.find(i => i.nameEn.includes('GWP-total'));
    expect(gwpTotal).toBeDefined();
    expect(gwpTotal!.uuid).toBe('a7ea142a-9749-11ed-a8fc-0242ac120002');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/schema/__tests__/indicator-parser.test.ts
```

Expected: FAIL — `parseIndicatorCSV` not found.

- [ ] **Step 4: Implement indicator CSV parser**

Create `src/schema/indicator-parser.ts`:
```ts
import type { Indicator, IndicatorCategory, IndicatorSet, StandardVersion, CountryIndicator } from './types';

export function parseIndicatorCSV(csv: string, standardVersion: StandardVersion): IndicatorSet {
  const lines = csv.split('\n').map(l => l.trim());
  // Skip header row
  const dataLines = lines.slice(1);

  const exchanges: Indicator[] = [];
  const lcia: Indicator[] = [];
  let currentCategory: IndicatorCategory = 'exchange';

  // A1 CSV format: UUID,Name (en),Unit (en),UnitGroup UUID,de,Einheit (de)
  // A2 CSV format: UUID,Version,Name (en),Unit (en),UnitGroup UUID,Name (de),Einheit (de)
  const isA1 = standardVersion === '+A1';

  for (const line of dataLines) {
    const cols = parseCSVLine(line);

    // Blank UUID = separator between exchange and lcia sections
    const uuid = cols[0]?.trim();
    if (!uuid) {
      if (currentCategory === 'exchange' && exchanges.length > 0) {
        currentCategory = 'lcia';
      }
      continue;
    }

    // Skip metadata rows like "updated", "new"
    if (uuid.length < 36) continue;

    const indicator: Indicator = isA1
      ? {
          uuid,
          version: '',
          nameEn: cols[1]?.trim() || '',
          unitEn: cols[2]?.trim() || '',
          unitGroupUuid: cols[3]?.trim() || '',
          nameDe: cols[4]?.trim() || '',
          unitDe: cols[5]?.trim() || '',
          category: currentCategory,
        }
      : {
          uuid,
          version: cols[1]?.trim() || '',
          nameEn: cols[2]?.trim() || '',
          unitEn: cols[3]?.trim() || '',
          unitGroupUuid: cols[4]?.trim() || '',
          nameDe: cols[5]?.trim() || '',
          unitDe: cols[6]?.trim() || '',
          category: currentCategory,
        };

    if (currentCategory === 'exchange') {
      exchanges.push(indicator);
    } else {
      lcia.push(indicator);
    }
  }

  return {
    standardVersion,
    exchanges,
    lcia,
    all: [...exchanges, ...lcia],
  };
}

export function parseCountryIndicatorCSV(csv: string): CountryIndicator[] {
  const lines = csv.split('\n').map(l => l.trim());
  const dataLines = lines.slice(1);
  const indicators: CountryIndicator[] = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    const uuid = cols[0]?.trim();
    if (!uuid || uuid.length < 36) continue;

    indicators.push({
      uuid,
      version: '',
      nameEn: cols[1]?.trim() || '',
      unitEn: cols[2]?.trim() || '',
      unitGroupUuid: cols[3]?.trim() || '',
      nameDe: '',
      unitDe: '',
      category: 'lcia',
      countries: (cols[4]?.trim() || '').split(',').map(c => c.trim()).filter(Boolean),
    });
  }

  return indicators;
}

export function parseCommonReferencesCSV(csv: string) {
  const lines = csv.split('\n').map(l => l.trim());
  const dataLines = lines.slice(1);
  const refs: Array<{ name: string; datasetType: string; uuid: string; version: string }> = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    const name = cols[0]?.trim();
    if (!name) continue;

    refs.push({
      name,
      datasetType: cols[1]?.trim() || '',
      uuid: cols[2]?.trim() || '',
      version: cols[3]?.trim() || '',
    });
  }

  return refs;
}

export function parseFlowPropertiesCSV(csv: string) {
  const lines = csv.split('\n').map(l => l.trim());
  const dataLines = lines.slice(1);
  const props: Array<{
    name: string;
    uuid: string;
    version: string;
    referenceUnit: string;
    unitGroupName: string;
    unitGroupUuid: string;
  }> = [];

  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    const name = cols[0]?.trim();
    const uuid = cols[2]?.trim();
    if (!name || !uuid) continue;

    props.push({
      name,
      uuid,
      version: cols[3]?.trim() || '',
      referenceUnit: cols[4]?.trim() || '',
      unitGroupName: cols[5]?.trim() || '',
      unitGroupUuid: cols[7]?.trim() || '',
    });
  }

  return props;
}

/** Parse a CSV line handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/schema/__tests__/indicator-parser.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add epd-generator/src/schema/
git commit -m "feat: add indicator CSV parser with exchange/LCIA separation"
```

---

### Task 3: Build Schema Registry

**Files:**
- Create: `epd-generator/src/schema/registry.ts`
- Create: `epd-generator/src/schema/standard-configs.ts`
- Create: `epd-generator/src/schema/namespaces.ts`
- Test: `epd-generator/src/schema/__tests__/registry.test.ts`

- [ ] **Step 1: Define namespace constants**

Create `src/schema/namespaces.ts`:
```ts
export const NS = {
  PROCESS: 'http://lca.jrc.it/ILCD/Process',
  COMMON: 'http://lca.jrc.it/ILCD/Common',
  EPD_2013: 'http://www.iai.kit.edu/EPD/2013',
  EPD_2019: 'http://www.indata.network/EPD/2019',
  EPD_2024: 'http://www.indata.network/EPD/2024',
  XSI: 'http://www.w3.org/2001/XMLSchema-instance',
  MATML: 'http://www.matml.org/',
  FLOW: 'http://lca.jrc.it/ILCD/Flow',
  CONTACT: 'http://lca.jrc.it/ILCD/Contact',
  SOURCE: 'http://lca.jrc.it/ILCD/Source',
  UNIT_GROUP: 'http://lca.jrc.it/ILCD/UnitGroup',
  FLOW_PROPERTY: 'http://lca.jrc.it/ILCD/FlowProperty',
  LCIA_METHOD: 'http://lca.jrc.it/ILCD/LCIAMethod',
} as const;

export const NS_PREFIX: Record<string, string> = {
  [NS.PROCESS]: '',
  [NS.COMMON]: 'common',
  [NS.EPD_2013]: 'epd',
  [NS.EPD_2019]: 'epd2',
  [NS.EPD_2024]: 'epd24',
  [NS.XSI]: 'xsi',
  [NS.MATML]: 'mat',
};
```

- [ ] **Step 2: Define standard version configurations**

Create `src/schema/standard-configs.ts`:
```ts
import type { StandardVersion } from './types';
import { NS } from './namespaces';

export interface StandardConfig {
  version: StandardVersion;
  label: string;
  indicatorCsvFile: string;
  namespaces: string[];      // which EPD extension namespaces to include
  features: {
    contentDeclaration: boolean;
    serviceLife: boolean;
    svhc: boolean;
    variability: boolean;
    manufacturers: boolean;   // rich manufacturer/site structure
    productIds: boolean;
    scenarioData: boolean;
  };
  complianceRef: {
    uuid: string;
    name: string;
  };
  dataFormatRefs: Array<{ uuid: string; name: string; version: string }>;
}

export const STANDARD_CONFIGS: Record<StandardVersion, StandardConfig> = {
  '+A1': {
    version: '+A1',
    label: 'EN 15804+A1',
    indicatorCsvFile: 'EN15804+A1_indicators.csv',
    namespaces: [NS.EPD_2013],
    features: {
      contentDeclaration: false,
      serviceLife: false,
      svhc: false,
      variability: false,
      manufacturers: false,
      productIds: false,
      scenarioData: false,
    },
    complianceRef: {
      uuid: 'b00f9ec0-7874-11e3-981f-0800200c9a66',
      name: 'EN 15804+A1',
    },
    dataFormatRefs: [
      { uuid: 'a97a0155-0234-4b87-b4ce-a45da52f2a40', name: 'ILCD format', version: '01.00.000' },
      { uuid: 'cba73800-7874-11e3-981f-0800200c9a66', name: 'EPD Data Format Extensions v1.1', version: '00.01.000' },
    ],
  },
  '+A2/EF3.0': {
    version: '+A2/EF3.0',
    label: 'EN 15804+A2 (EF 3.0)',
    indicatorCsvFile: 'EN15804+A2_EF3.0_indicators.csv',
    namespaces: [NS.EPD_2013, NS.EPD_2019],
    features: {
      contentDeclaration: true,
      serviceLife: false,
      svhc: false,
      variability: true,
      manufacturers: false,
      productIds: false,
      scenarioData: false,
    },
    complianceRef: {
      uuid: 'c0016b33-8cf7-415c-ac6e-deba0d21440d',
      name: 'EN 15804+A2',
    },
    dataFormatRefs: [
      { uuid: 'a97a0155-0234-4b87-b4ce-a45da52f2a40', name: 'ILCD format', version: '01.00.000' },
      { uuid: 'a29449fd-aa2f-4de8-b5d7-4b06b43c6fde', name: 'EPD Data Format Extensions v1.2', version: '00.01.000' },
    ],
  },
  '+A2/EF3.1': {
    version: '+A2/EF3.1',
    label: 'EN 15804+A2 (EF 3.1)',
    indicatorCsvFile: 'EN15804+A2_EF3.1_indicators.csv',
    namespaces: [NS.EPD_2013, NS.EPD_2019, NS.EPD_2024],
    features: {
      contentDeclaration: true,
      serviceLife: true,
      svhc: true,
      variability: true,
      manufacturers: true,
      productIds: true,
      scenarioData: true,
    },
    complianceRef: {
      uuid: 'd4aa3ec7-b1d7-4a4a-a6cb-37af88dcc902',
      name: 'EN 15804+A2 (EF 3.1)',
    },
    dataFormatRefs: [
      { uuid: 'a97a0155-0234-4b87-b4ce-a45da52f2a40', name: 'ILCD format', version: '01.00.000' },
      { uuid: 'a29449fd-aa2f-4de8-b5d7-4b06b43c6fde', name: 'EPD Data Format Extensions v1.2', version: '00.01.000' },
    ],
  },
};

export const ALL_MODULES = [
  'A1', 'A2', 'A3', 'A1-A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
  'C1', 'C2', 'C3', 'C4',
  'D',
] as const;

export const EPD_SUB_TYPES = [
  'specific dataset',
  'average dataset',
  'representative dataset',
  'generic dataset',
  'template dataset',
] as const;
```

- [ ] **Step 3: Write failing test for registry**

Create `src/schema/__tests__/registry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SchemaRegistry } from '../registry';

describe('SchemaRegistry', () => {
  it('loads all three standard versions', () => {
    const registry = SchemaRegistry.create();
    expect(registry.getIndicatorSet('+A1')).toBeDefined();
    expect(registry.getIndicatorSet('+A2/EF3.0')).toBeDefined();
    expect(registry.getIndicatorSet('+A2/EF3.1')).toBeDefined();
  });

  it('returns correct config for each standard', () => {
    const registry = SchemaRegistry.create();
    const a1Config = registry.getConfig('+A1');
    expect(a1Config.features.contentDeclaration).toBe(false);

    const a2Config = registry.getConfig('+A2/EF3.1');
    expect(a2Config.features.contentDeclaration).toBe(true);
    expect(a2Config.features.svhc).toBe(true);
  });

  it('loads common references', () => {
    const registry = SchemaRegistry.create();
    const refs = registry.getCommonReferences();
    expect(refs.length).toBeGreaterThan(0);
    const ilcdFormat = refs.find(r => r.name === 'ILCD Format');
    expect(ilcdFormat).toBeDefined();
    expect(ilcdFormat!.uuid).toBe('a97a0155-0234-4b87-b4ce-a45da52f2a40');
  });

  it('loads flow properties', () => {
    const registry = SchemaRegistry.create();
    const props = registry.getFlowProperties();
    const mass = props.find(p => p.name === 'Mass');
    expect(mass).toBeDefined();
    expect(mass!.uuid).toBe('93a60a56-a3c8-11da-a746-0800200b9a66');
  });

  it('loads country-specific indicators', () => {
    const registry = SchemaRegistry.create();
    const countryIndicators = registry.getCountryIndicators();
    expect(countryIndicators.length).toBeGreaterThan(0);
    const gwpIobc = countryIndicators.find(i => i.nameEn.includes('GWP-IOBC'));
    expect(gwpIobc).toBeDefined();
    expect(gwpIobc!.countries).toContain('Finland');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/schema/__tests__/registry.test.ts
```

Expected: FAIL — `SchemaRegistry` not found.

- [ ] **Step 5: Implement SchemaRegistry**

Create `src/schema/registry.ts`:
```ts
import type { StandardVersion, IndicatorSet, CountryIndicator } from './types';
import type { StandardConfig } from './standard-configs';
import { STANDARD_CONFIGS } from './standard-configs';
import { parseIndicatorCSV, parseCountryIndicatorCSV, parseCommonReferencesCSV, parseFlowPropertiesCSV } from './indicator-parser';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const IDENTIFIERS_DIR = resolve(__dirname, '../../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers');

function loadCSV(filename: string): string {
  return readFileSync(resolve(IDENTIFIERS_DIR, filename), 'utf-8');
}

export class SchemaRegistry {
  private indicatorSets: Map<StandardVersion, IndicatorSet>;
  private commonRefs: ReturnType<typeof parseCommonReferencesCSV>;
  private flowProps: ReturnType<typeof parseFlowPropertiesCSV>;
  private countryIndicators: CountryIndicator[];

  private constructor() {
    this.indicatorSets = new Map();
    this.commonRefs = [];
    this.flowProps = [];
    this.countryIndicators = [];
  }

  static create(): SchemaRegistry {
    const registry = new SchemaRegistry();

    // Load indicator sets for all standard versions
    for (const config of Object.values(STANDARD_CONFIGS)) {
      const csv = loadCSV(config.indicatorCsvFile);
      const indicatorSet = parseIndicatorCSV(csv, config.version);
      registry.indicatorSets.set(config.version, indicatorSet);
    }

    // Load shared reference data
    registry.commonRefs = parseCommonReferencesCSV(loadCSV('Common_references.csv'));
    registry.flowProps = parseFlowPropertiesCSV(loadCSV('Flow_properties_and_unit_groups.csv'));
    registry.countryIndicators = parseCountryIndicatorCSV(loadCSV('Country-specific_indicators.csv'));

    return registry;
  }

  getIndicatorSet(version: StandardVersion): IndicatorSet {
    const set = this.indicatorSets.get(version);
    if (!set) throw new Error(`Unknown standard version: ${version}`);
    return set;
  }

  getConfig(version: StandardVersion): StandardConfig {
    const config = STANDARD_CONFIGS[version];
    if (!config) throw new Error(`Unknown standard version: ${version}`);
    return config;
  }

  getCommonReferences() {
    return this.commonRefs;
  }

  getFlowProperties() {
    return this.flowProps;
  }

  getCountryIndicators() {
    return this.countryIndicators;
  }

  getCountryIndicatorsFor(country: string) {
    return this.countryIndicators.filter(i => i.countries.includes(country));
  }

  getAvailableCountries(): string[] {
    const countries = new Set<string>();
    for (const ind of this.countryIndicators) {
      for (const c of ind.countries) countries.add(c);
    }
    return [...countries].sort();
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/schema/__tests__/registry.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add epd-generator/src/schema/
git commit -m "feat: add schema registry with indicator sets, common refs, and flow properties"
```

---

## Chunk 2: Data Model & Store

### Task 4: Define Complete Data Model

**Files:**
- Create: `epd-generator/src/model/epd-dataset.ts`
- Create: `epd-generator/src/model/index.ts`

- [ ] **Step 1: Create the EPDDataset model**

Create `src/model/epd-dataset.ts`:
```ts
import type { MultiLangString, Reference, StandardVersion, EPDSubType, ModuleName } from '../schema/types';
import { v4 as uuidv4 } from 'uuid';

// --- Sub-types ---

export interface Scenario {
  name: string;
  group: string;
  default: boolean;
  description: MultiLangString[];
}

export interface SafetyMargins {
  margins: number;
  description: MultiLangString[];
}

export interface Variability {
  manufacturerVariability: { type: string; variation: number; variationRange?: string };
  productVariability: { type: string; variation: number; variationRange?: string };
  description: MultiLangString[];
}

export interface RangeValue {
  value?: number;
  lowerValue?: number;
  upperValue?: number;
}

export interface Substance {
  name: string;
  weightPerc: RangeValue;
  CASNumber?: string;
  ECNumber?: string;
  hazardCode?: string;
  packaging?: boolean;
}

export interface Material {
  name: MultiLangString[];
  weightPerc: RangeValue;
  mass: RangeValue;
  CASNumber?: string;
  ECNumber?: string;
  ddGUID?: string;
  renewable?: number;
  recycled?: number;
  recyclable?: number;
  packaging?: boolean;
  substances: Substance[];
}

export interface Component {
  name: string;
  weightPerc: RangeValue;
  materials: Material[];
}

export interface ContentDeclaration {
  components: Component[];
  materials: Material[];
  substances: Substance[];
}

export type MatMLPropertyName =
  | 'gross density'
  | 'bulk density'
  | 'grammage'
  | 'layer thickness'
  | 'productiveness'
  | 'linear density'
  | 'conversion factor to 1 kg';

export interface MatMLProperty {
  propertyName: MatMLPropertyName;
  value: number;
  materialName: string;
}

export interface Site {
  name: string;
  facilityIdentifier?: string;
  olc?: string;
  geoCode?: string;
  streetAddress?: string;
}

export interface Manufacturer {
  contact: Reference;
  isProvidingData: boolean;
  sites: Site[];
}

export interface ClassEntry {
  level: number;
  value: string;
}

export interface ComplianceRef {
  system: Reference;
  overallCompliance?: string;
}

export interface Exchange {
  dataSetInternalID: number;
  flowRef: Reference;
  exchangeDirection: 'Input' | 'Output';
  meanAmount: number;
  amounts: Array<{ module: ModuleName; scenario?: string; value: number }>;
  unitGroupRef: Reference;
}

export interface LCIAResult {
  methodRef: Reference;
  meanAmount: number;
  amounts: Array<{ module: ModuleName; scenario?: string; value: number }>;
  unitGroupRef: Reference;
}

// --- Main Dataset ---

export interface EPDDataset {
  meta: {
    standardVersion: StandardVersion;
    subType: EPDSubType;
    uuid: string;
    dataSetVersion: string;
    epdVersion: string;
  };

  processInfo: {
    name: MultiLangString[];
    classification: { classesFile: string; entries: ClassEntry[] };
    generalComment: MultiLangString[];
    referenceYear: number;
    validUntil: number;
    publicationDateOfEPD?: string;
    expirationDateOfEPD?: string;
    location: string;
    locationDescription: MultiLangString[];
    technologyDescription: MultiLangString[];
    technologicalApplicability: MultiLangString[];
    serviceLife?: {
      years: number;
      standardRef: Reference;
      comment: MultiLangString[];
    };
    scenarios: Scenario[];
    safetyMargins?: SafetyMargins;
    variability?: Variability;
    svhc?: { present: boolean };
    contentDeclaration?: ContentDeclaration;
  };

  productFlow: {
    uuid: string;
    name: MultiLangString[];
    declaredUnit: {
      flowPropertyRef: Reference;
      unitGroupRef: Reference;
    };
    isA: Reference | null;
    materialProperties: MatMLProperty[];
  };

  quantitativeReference: {
    referenceToReferenceFlow: number; // dataSetInternalID
  };

  exchanges: Exchange[];
  lciaResults: LCIAResult[];

  organisations: {
    manufacturers: Manufacturer[];
    commissioner: Reference | null;
    dataGenerator: Reference | null;
    programmeOperator: Reference | null;
    verifier: Reference | null;
    ownerOfDataSet: Reference | null;
  };

  complianceDeclarations: ComplianceRef[];

  dataEntryBy: {
    timestamp: string;
    referenceToDataSetFormat: Reference[];
  };

  publicationAndOwnership: {
    dataSetVersion: string;
    dateOfLastRevision: string;
    registrationAuthority: Reference | null;
    registrationNumber: string;
    referenceToOwner: Reference | null;
    copyright: boolean;
    licenseType: string;
    referenceToPublisher: Reference | null;
    referenceToOriginalEPD: Reference | null;
  };

  sources: {
    pcr: Reference | null;
    backgroundDatabases: Reference[];
    epdDocument: Reference | null;
    dataHandlingPrinciples: Reference | null;
    technologyPicture: Reference | null;
    technologyFlowDiagram: Reference | null;
    additionalSources: Reference[];
  };

  declaredModules: Set<ModuleName>;
}

export function createEmptyDataset(standardVersion: StandardVersion = '+A2/EF3.1'): EPDDataset {
  const now = new Date().toISOString();
  return {
    meta: {
      standardVersion,
      subType: 'specific dataset',
      uuid: uuidv4(),
      dataSetVersion: '00.01.000',
      epdVersion: '1.3',
    },
    processInfo: {
      name: [{ lang: 'en', value: '' }],
      classification: { classesFile: '', entries: [] },
      generalComment: [],
      referenceYear: new Date().getFullYear(),
      validUntil: new Date().getFullYear() + 5,
      location: '',
      locationDescription: [],
      technologyDescription: [],
      technologicalApplicability: [],
      scenarios: [],
    },
    productFlow: {
      uuid: uuidv4(),
      name: [{ lang: 'en', value: '' }],
      declaredUnit: {
        flowPropertyRef: { type: 'flow property data set', refObjectId: '', shortDescription: [] },
        unitGroupRef: { type: 'unit group data set', refObjectId: '', shortDescription: [] },
      },
      isA: null,
      materialProperties: [],
    },
    quantitativeReference: {
      referenceToReferenceFlow: 0,
    },
    exchanges: [],
    lciaResults: [],
    organisations: {
      manufacturers: [],
      commissioner: null,
      dataGenerator: null,
      programmeOperator: null,
      verifier: null,
      ownerOfDataSet: null,
    },
    complianceDeclarations: [],
    dataEntryBy: {
      timestamp: now,
      referenceToDataSetFormat: [],
    },
    publicationAndOwnership: {
      dataSetVersion: '00.01.000',
      dateOfLastRevision: now,
      registrationAuthority: null,
      registrationNumber: '',
      referenceToOwner: null,
      copyright: true,
      licenseType: 'Free of charge for all users and uses',
      referenceToPublisher: null,
      referenceToOriginalEPD: null,
    },
    sources: {
      pcr: null,
      backgroundDatabases: [],
      epdDocument: null,
      dataHandlingPrinciples: null,
      technologyPicture: null,
      technologyFlowDiagram: null,
      additionalSources: [],
    },
    declaredModules: new Set(),
  };
}
```

- [ ] **Step 2: Create index barrel**

Create `src/model/index.ts`:
```ts
export * from './epd-dataset';
```

- [ ] **Step 3: Commit**

```bash
git add epd-generator/src/model/
git commit -m "feat: add complete EPDDataset data model with factory function"
```

---

### Task 5: Create Zustand Store

**Files:**
- Create: `epd-generator/src/store/epd-store.ts`
- Create: `epd-generator/src/store/index.ts`
- Test: `epd-generator/src/store/__tests__/epd-store.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/store/__tests__/epd-store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useEPDStore } from '../epd-store';

describe('EPD Store', () => {
  beforeEach(() => {
    useEPDStore.getState().reset();
  });

  it('initializes with empty dataset', () => {
    const state = useEPDStore.getState();
    expect(state.dataset.meta.standardVersion).toBe('+A2/EF3.1');
    expect(state.currentStep).toBe(0);
  });

  it('updates standard version and resets dependent fields', () => {
    const { setStandardVersion } = useEPDStore.getState();
    setStandardVersion('+A1');
    expect(useEPDStore.getState().dataset.meta.standardVersion).toBe('+A1');
  });

  it('navigates wizard steps', () => {
    const store = useEPDStore.getState();
    store.setStep(3);
    expect(useEPDStore.getState().currentStep).toBe(3);
  });

  it('updates process info fields', () => {
    const { updateProcessInfo } = useEPDStore.getState();
    updateProcessInfo({ referenceYear: 2025 });
    expect(useEPDStore.getState().dataset.processInfo.referenceYear).toBe(2025);
  });

  it('toggles declared modules', () => {
    const { toggleModule } = useEPDStore.getState();
    toggleModule('A1-A3');
    expect(useEPDStore.getState().dataset.declaredModules.has('A1-A3')).toBe(true);
    toggleModule('A1-A3');
    expect(useEPDStore.getState().dataset.declaredModules.has('A1-A3')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/store/__tests__/epd-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

Create `src/store/epd-store.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EPDDataset } from '../model/epd-dataset';
import { createEmptyDataset } from '../model/epd-dataset';
import type { StandardVersion, ModuleName } from '../schema/types';

interface EPDStoreState {
  dataset: EPDDataset;
  currentStep: number;

  // Navigation
  setStep: (step: number) => void;

  // Meta
  setStandardVersion: (version: StandardVersion) => void;

  // Process info
  updateProcessInfo: (partial: Partial<EPDDataset['processInfo']>) => void;

  // Product flow
  updateProductFlow: (partial: Partial<EPDDataset['productFlow']>) => void;

  // Organisations
  updateOrganisations: (partial: Partial<EPDDataset['organisations']>) => void;

  // Modules
  toggleModule: (module: ModuleName) => void;

  // Sources
  updateSources: (partial: Partial<EPDDataset['sources']>) => void;

  // Full dataset update
  updateDataset: (partial: Partial<EPDDataset>) => void;

  // Reset
  reset: () => void;
}

// Custom serialization for Set (JSON doesn't support Set)
const serializeState = (state: EPDStoreState) => {
  return {
    ...state,
    dataset: {
      ...state.dataset,
      declaredModules: [...state.dataset.declaredModules],
    },
  };
};

const deserializeState = (raw: any): Partial<EPDStoreState> => {
  if (raw?.dataset?.declaredModules && Array.isArray(raw.dataset.declaredModules)) {
    raw.dataset.declaredModules = new Set(raw.dataset.declaredModules);
  }
  return raw;
};

export const useEPDStore = create<EPDStoreState>()(
  persist(
    (set) => ({
      dataset: createEmptyDataset(),
      currentStep: 0,

      setStep: (step) => set({ currentStep: step }),

      setStandardVersion: (version) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            meta: { ...state.dataset.meta, standardVersion: version },
            exchanges: [],
            lciaResults: [],
          },
        })),

      updateProcessInfo: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            processInfo: { ...state.dataset.processInfo, ...partial },
          },
        })),

      updateProductFlow: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            productFlow: { ...state.dataset.productFlow, ...partial },
          },
        })),

      updateOrganisations: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            organisations: { ...state.dataset.organisations, ...partial },
          },
        })),

      toggleModule: (module) =>
        set((state) => {
          const modules = new Set(state.dataset.declaredModules);
          if (modules.has(module)) {
            modules.delete(module);
          } else {
            modules.add(module);
          }
          return { dataset: { ...state.dataset, declaredModules: modules } };
        }),

      updateSources: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            sources: { ...state.dataset.sources, ...partial },
          },
        })),

      updateDataset: (partial) =>
        set((state) => ({
          dataset: { ...state.dataset, ...partial },
        })),

      reset: () => set({ dataset: createEmptyDataset(), currentStep: 0 }),
    }),
    {
      name: 'epd-generator-storage',
      serialize: (state) => JSON.stringify(serializeState(state as any)),
      deserialize: (str) => deserializeState(JSON.parse(str)) as any,
    }
  )
);
```

Create `src/store/index.ts`:
```ts
export { useEPDStore } from './epd-store';
```

- [ ] **Step 4: Run tests**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/store/__tests__/epd-store.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add epd-generator/src/store/
git commit -m "feat: add Zustand store with localStorage persistence and Set serialization"
```

---

## Chunk 3: XML Generator

### Task 6: Build XML Serializer for Process Dataset

**Files:**
- Create: `epd-generator/src/generators/xml/process-xml.ts`
- Create: `epd-generator/src/generators/xml/xml-utils.ts`
- Test: `epd-generator/src/generators/__tests__/process-xml.test.ts`

- [ ] **Step 1: Create XML utility functions**

Create `src/generators/xml/xml-utils.ts`:
```ts
import type { MultiLangString, Reference } from '../../schema/types';

export function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderMultiLang(tagName: string, strings: MultiLangString[], indent: string): string {
  return strings
    .filter(s => s.value)
    .map(s => `${indent}<${tagName} xml:lang="${s.lang}">${xmlEscape(s.value)}</${tagName}>`)
    .join('\n');
}

export function renderReference(tagName: string, ref: Reference, indent: string, extraAttrs?: string): string {
  const attrs = [
    `type="${xmlEscape(ref.type)}"`,
    `refObjectId="${xmlEscape(ref.refObjectId)}"`,
  ];
  if (ref.version) attrs.push(`version="${xmlEscape(ref.version)}"`);
  if (ref.uri) attrs.push(`uri="${xmlEscape(ref.uri)}"`);
  if (extraAttrs) attrs.push(extraAttrs);

  const descriptions = ref.shortDescription
    .filter(s => s.value)
    .map(s => `${indent}    <common:shortDescription xml:lang="${s.lang}">${xmlEscape(s.value)}</common:shortDescription>`)
    .join('\n');

  if (!descriptions) {
    return `${indent}<${tagName} ${attrs.join(' ')}/>`;
  }

  return `${indent}<${tagName} ${attrs.join(' ')}>\n${descriptions}\n${indent}</${tagName}>`;
}
```

- [ ] **Step 2: Write failing test for process XML generation**

Create `src/generators/__tests__/process-xml.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateProcessXML } from '../xml/process-xml';
import { createEmptyDataset } from '../../model/epd-dataset';

describe('generateProcessXML', () => {
  it('generates valid XML with correct root element and namespaces', () => {
    const dataset = createEmptyDataset('+A2/EF3.1');
    dataset.processInfo.name = [{ lang: 'en', value: 'Test Product' }];

    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<processDataSet');
    expect(xml).toContain('xmlns="http://lca.jrc.it/ILCD/Process"');
    expect(xml).toContain('xmlns:common="http://lca.jrc.it/ILCD/Common"');
    expect(xml).toContain('xmlns:epd="http://www.iai.kit.edu/EPD/2013"');
    expect(xml).toContain('xmlns:epd2="http://www.indata.network/EPD/2019"');
    expect(xml).toContain('xmlns:epd24="http://www.indata.network/EPD/2024"');
    expect(xml).toContain('epd2:epd-version="1.3"');
  });

  it('includes process information section', () => {
    const dataset = createEmptyDataset('+A2/EF3.1');
    dataset.processInfo.name = [
      { lang: 'en', value: 'Wood panel' },
      { lang: 'de', value: 'Holzpanel' },
    ];
    dataset.meta.uuid = '57a4ae65-d305-421e-b21f-a3f0c35b8abe';

    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<common:UUID>57a4ae65-d305-421e-b21f-a3f0c35b8abe</common:UUID>');
    expect(xml).toContain('<baseName xml:lang="en">Wood panel</baseName>');
    expect(xml).toContain('<baseName xml:lang="de">Holzpanel</baseName>');
  });

  it('includes typeOfDataSet as EPD', () => {
    const dataset = createEmptyDataset();
    const xml = generateProcessXML(dataset);
    expect(xml).toContain('<typeOfDataSet>EPD</typeOfDataSet>');
  });

  it('includes subType', () => {
    const dataset = createEmptyDataset();
    dataset.meta.subType = 'average dataset';
    const xml = generateProcessXML(dataset);
    expect(xml).toContain('<epd:subType>average dataset</epd:subType>');
  });

  it('omits epd24 namespace for +A1 datasets', () => {
    const dataset = createEmptyDataset('+A1');
    const xml = generateProcessXML(dataset);
    expect(xml).not.toContain('xmlns:epd24');
    expect(xml).not.toContain('xmlns:epd2');
  });

  it('generates exchanges with epd:amount per module', () => {
    const dataset = createEmptyDataset();
    dataset.exchanges = [{
      dataSetInternalID: 43,
      flowRef: {
        type: 'flow data set',
        refObjectId: 'a2b32f97-3fc7-4af2-b209-525bc6426f33',
        shortDescription: [{ lang: 'en', value: 'Components for re-use (CRU)' }],
      },
      exchangeDirection: 'Output',
      meanAmount: 0.0,
      amounts: [
        { module: 'A1-A3', value: 5.984 },
        { module: 'D', scenario: '100% recycling', value: 1.117 },
      ],
      unitGroupRef: {
        type: 'unit group data set',
        refObjectId: 'ad38d542-3fe9-439d-9b95-2f5f7752acaf',
        shortDescription: [{ lang: 'en', value: 'kg' }],
      },
    }];

    const xml = generateProcessXML(dataset);

    expect(xml).toContain('dataSetInternalID="43"');
    expect(xml).toContain('<exchangeDirection>Output</exchangeDirection>');
    expect(xml).toContain('epd:module="A1-A3"');
    expect(xml).toContain('epd:scenario="100% recycling"');
  });

  it('generates LCIAResults', () => {
    const dataset = createEmptyDataset();
    dataset.lciaResults = [{
      methodRef: {
        type: 'LCIA method data set',
        refObjectId: 'b2ad6494-c78d-11e6-9d9d-cec0c932ce01',
        shortDescription: [{ lang: 'en', value: 'ADPE' }],
      },
      meanAmount: 0.0,
      amounts: [{ module: 'A1-A3', value: 12.5 }],
      unitGroupRef: {
        type: 'unit group data set',
        refObjectId: '54ccd2d9-a32a-4fc2-923d-f2c8c93e89d4',
        shortDescription: [{ lang: 'en', value: 'kg Sb-eqv.' }],
      },
    }];

    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<LCIAResults>');
    expect(xml).toContain('<LCIAResult>');
    expect(xml).toContain('referenceToLCIAMethodDataSet');
    expect(xml).toContain('b2ad6494-c78d-11e6-9d9d-cec0c932ce01');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/generators/__tests__/process-xml.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement process XML generator**

Create `src/generators/xml/process-xml.ts` — this is the core generator. It must produce XML matching the structure of the sample files.

```ts
import type { EPDDataset, Exchange, LCIAResult } from '../../model/epd-dataset';
import { NS } from '../../schema/namespaces';
import { STANDARD_CONFIGS } from '../../schema/standard-configs';
import { xmlEscape, renderMultiLang, renderReference } from './xml-utils';

export function generateProcessXML(dataset: EPDDataset): string {
  const config = STANDARD_CONFIGS[dataset.meta.standardVersion];
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(renderRootOpen(dataset, config));
  lines.push(renderProcessInformation(dataset, config));
  lines.push(renderModellingAndValidation(dataset, config));
  lines.push(renderAdministrativeInformation(dataset, config));
  lines.push(renderExchanges(dataset));
  lines.push(renderLCIAResults(dataset));
  lines.push('</processDataSet>');

  return lines.join('\n');
}

function renderRootOpen(dataset: EPDDataset, config: typeof STANDARD_CONFIGS['+A2/EF3.1']): string {
  const nsAttrs = [
    `xmlns="${NS.PROCESS}"`,
    `xmlns:common="${NS.COMMON}"`,
  ];

  if (config.namespaces.includes(NS.EPD_2013)) nsAttrs.push(`xmlns:epd="${NS.EPD_2013}"`);
  if (config.namespaces.includes(NS.EPD_2019)) nsAttrs.push(`xmlns:epd2="${NS.EPD_2019}"`);
  if (config.namespaces.includes(NS.EPD_2024)) nsAttrs.push(`xmlns:epd24="${NS.EPD_2024}"`);

  nsAttrs.push(`xmlns:xsi="${NS.XSI}"`);
  nsAttrs.push(`xsi:schemaLocation="${NS.PROCESS} ../../schemas/EPD_DataSet.xsd"`);
  nsAttrs.push('version="1.1"');

  if (config.namespaces.includes(NS.EPD_2019)) {
    nsAttrs.push(`epd2:epd-version="${dataset.meta.epdVersion}"`);
  }

  return `<processDataSet ${nsAttrs.join('\n    ')}>`;
}

function renderProcessInformation(dataset: EPDDataset, config: typeof STANDARD_CONFIGS['+A2/EF3.1']): string {
  const d = dataset.processInfo;
  const lines: string[] = [];
  lines.push('    <processInformation>');
  lines.push('        <dataSetInformation>');
  lines.push(`            <common:UUID>${xmlEscape(dataset.meta.uuid)}</common:UUID>`);
  lines.push('            <name>');
  lines.push(renderMultiLang('baseName', d.name, '                '));
  lines.push('            </name>');

  if (d.classification.entries.length > 0) {
    lines.push('            <classificationInformation>');
    const classesAttr = d.classification.classesFile ? ` classes="${xmlEscape(d.classification.classesFile)}"` : '';
    lines.push(`                <common:classification${classesAttr}>`);
    for (const entry of d.classification.entries) {
      lines.push(`                    <common:class level="${entry.level}">${xmlEscape(entry.value)}</common:class>`);
    }
    lines.push('                </common:classification>');
    lines.push('            </classificationInformation>');
  }

  if (d.generalComment.length > 0) {
    lines.push(renderMultiLang('common:generalComment', d.generalComment, '            '));
  }

  // EPD extensions in common:other
  const hasOther = d.scenarios.length > 0 || d.safetyMargins || d.svhc ||
    d.contentDeclaration || d.serviceLife || d.variability;
  if (hasOther) {
    lines.push('            <common:other>');

    if (d.serviceLife && config.features.serviceLife) {
      lines.push(`                <epd24:serviceLife>`);
      lines.push(`                    <epd24:years>${d.serviceLife.years}</epd24:years>`);
      lines.push(renderReference('epd24:referenceToStandard', d.serviceLife.standardRef, '                    '));
      lines.push(renderMultiLang('epd24:comment', d.serviceLife.comment, '                    '));
      lines.push(`                </epd24:serviceLife>`);
    }

    if (d.scenarios.length > 0) {
      lines.push('                <epd:scenarios>');
      for (const sc of d.scenarios) {
        const attrs = [`epd:name="${xmlEscape(sc.name)}"`, `epd:group="${xmlEscape(sc.group)}"`];
        if (sc.default) attrs.push('epd:default="true"');
        lines.push(`                    <epd:scenario ${attrs.join(' ')}>`);
        lines.push(renderMultiLang('epd:description', sc.description, '                        '));
        lines.push('                    </epd:scenario>');
      }
      lines.push('                </epd:scenarios>');
    }

    if (d.safetyMargins) {
      lines.push('                <epd:safetyMargins>');
      lines.push(`                    <epd:margins>${d.safetyMargins.margins}</epd:margins>`);
      lines.push(renderMultiLang('epd:description', d.safetyMargins.description, '                    '));
      lines.push('                </epd:safetyMargins>');
    }

    if (d.contentDeclaration && config.features.contentDeclaration) {
      lines.push(renderContentDeclaration(d.contentDeclaration, '                '));
    }

    if (d.svhc && config.features.svhc) {
      lines.push(`                <epd24:SVHC epd24:present="${d.svhc.present}" />`);
    }

    lines.push('            </common:other>');
  }

  lines.push('        </dataSetInformation>');

  // Quantitative reference
  lines.push('        <quantitativeReference type="Reference flow(s)">');
  lines.push(`            <referenceToReferenceFlow>${dataset.quantitativeReference.referenceToReferenceFlow}</referenceToReferenceFlow>`);
  lines.push('        </quantitativeReference>');

  // Time
  lines.push('        <time>');
  lines.push(`            <common:referenceYear>${d.referenceYear}</common:referenceYear>`);
  lines.push(`            <common:dataSetValidUntil>${d.validUntil}</common:dataSetValidUntil>`);
  if (d.publicationDateOfEPD || d.expirationDateOfEPD) {
    lines.push('            <common:other>');
    if (d.publicationDateOfEPD) lines.push(`                <epd2:publicationDateOfEPD>${d.publicationDateOfEPD}</epd2:publicationDateOfEPD>`);
    if (d.expirationDateOfEPD) lines.push(`                <epd24:expirationDateOfEPD>${d.expirationDateOfEPD}</epd24:expirationDateOfEPD>`);
    lines.push('            </common:other>');
  }
  lines.push('        </time>');

  // Geography
  lines.push('        <geography>');
  lines.push(`            <locationOfOperationSupplyOrProduction location="${xmlEscape(d.location)}">`);
  if (d.locationDescription.length > 0) {
    lines.push(renderMultiLang('descriptionOfRestrictions', d.locationDescription, '                '));
  }
  lines.push('            </locationOfOperationSupplyOrProduction>');
  lines.push('        </geography>');

  // Technology
  lines.push('        <technology>');
  if (d.technologyDescription.length > 0) {
    lines.push(renderMultiLang('technologyDescriptionAndIncludedProcesses', d.technologyDescription, '            '));
  }
  if (d.technologicalApplicability.length > 0) {
    lines.push(renderMultiLang('technologicalApplicability', d.technologicalApplicability, '            '));
  }
  if (dataset.sources.technologyFlowDiagram) {
    lines.push(renderReference('referenceToTechnologyFlowDiagrammOrPicture', dataset.sources.technologyFlowDiagram, '            '));
  }
  lines.push('        </technology>');

  lines.push('    </processInformation>');
  return lines.join('\n');
}

function renderContentDeclaration(cd: NonNullable<EPDDataset['processInfo']['contentDeclaration']>, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}<epd2:contentDeclaration>`);

  for (const mat of cd.materials) {
    const attrs: string[] = [];
    if (mat.packaging !== undefined) attrs.push(`epd2:packaging="${mat.packaging}"`);
    if (mat.renewable !== undefined) attrs.push(`epd2:renewable="${mat.renewable}"`);
    if (mat.recycled !== undefined) attrs.push(`epd2:recycled="${mat.recycled}"`);
    if (mat.recyclable !== undefined) attrs.push(`epd2:recyclable="${mat.recyclable}"`);
    if (mat.CASNumber) attrs.push(`epd2:CASNumber="${xmlEscape(mat.CASNumber)}"`);
    if (mat.ECNumber) attrs.push(`epd2:ECNumber="${xmlEscape(mat.ECNumber)}"`);

    lines.push(`${indent}    <epd2:material ${attrs.join(' ')}>`);
    lines.push(renderMultiLang('epd2:name', mat.name, `${indent}        `));
    lines.push(`${indent}        <epd2:weightPerc${renderRangeAttrs(mat.weightPerc)}/>`);
    lines.push(`${indent}        <epd2:mass${renderRangeAttrs(mat.mass)}/>`);
    lines.push(`${indent}    </epd2:material>`);
  }

  for (const sub of cd.substances) {
    const attrs: string[] = [];
    if (sub.CASNumber) attrs.push(`epd2:CASNumber="${xmlEscape(sub.CASNumber)}"`);
    if (sub.ECNumber) attrs.push(`epd2:ECNumber="${xmlEscape(sub.ECNumber)}"`);
    if (sub.hazardCode) attrs.push(`epd2:hazardCode="${xmlEscape(sub.hazardCode)}"`);
    lines.push(`${indent}    <epd2:substance ${attrs.join(' ')}>`);
    lines.push(`${indent}        <epd2:name>${xmlEscape(sub.name)}</epd2:name>`);
    lines.push(`${indent}        <epd2:weightPerc${renderRangeAttrs(sub.weightPerc)}/>`);
    lines.push(`${indent}    </epd2:substance>`);
  }

  lines.push(`${indent}</epd2:contentDeclaration>`);
  return lines.join('\n');
}

function renderRangeAttrs(rv: { value?: number; lowerValue?: number; upperValue?: number }): string {
  const attrs: string[] = [];
  if (rv.value !== undefined) attrs.push(` epd2:value="${rv.value}"`);
  if (rv.lowerValue !== undefined) attrs.push(` epd2:lowerValue="${rv.lowerValue}"`);
  if (rv.upperValue !== undefined) attrs.push(` epd2:upperValue="${rv.upperValue}"`);
  return attrs.join('');
}

function renderModellingAndValidation(dataset: EPDDataset, config: typeof STANDARD_CONFIGS['+A2/EF3.1']): string {
  const lines: string[] = [];
  lines.push('    <modellingAndValidation>');
  lines.push('        <LCIMethodAndAllocation>');
  lines.push('            <typeOfDataSet>EPD</typeOfDataSet>');

  if (dataset.sources.pcr) {
    lines.push(renderReference('referenceToLCAMethodDetails', dataset.sources.pcr, '            '));
  }

  lines.push('            <common:other>');
  lines.push(`                <epd:subType>${xmlEscape(dataset.meta.subType)}</epd:subType>`);

  if (dataset.processInfo.variability && config.features.variability) {
    const v = dataset.processInfo.variability;
    lines.push('                <epd24:variability>');
    const mAttrs = [`epd24:type="${xmlEscape(v.manufacturerVariability.type)}"`, `epd24:variation="${v.manufacturerVariability.variation}"`];
    if (v.manufacturerVariability.variationRange) mAttrs.push(`epd24:variationRange="${xmlEscape(v.manufacturerVariability.variationRange)}"`);
    lines.push(`                    <epd24:manufacturerVariability ${mAttrs.join(' ')}/>`);
    const pAttrs = [`epd24:type="${xmlEscape(v.productVariability.type)}"`, `epd24:variation="${v.productVariability.variation}"`];
    if (v.productVariability.variationRange) pAttrs.push(`epd24:variationRange="${xmlEscape(v.productVariability.variationRange)}"`);
    lines.push(`                    <epd24:productVariability ${pAttrs.join(' ')}/>`);
    lines.push(renderMultiLang('epd24:variabilityDescription', v.description, '                    '));
    lines.push('                </epd24:variability>');
  }

  lines.push('            </common:other>');
  lines.push('        </LCIMethodAndAllocation>');

  // Data sources
  lines.push('        <dataSourcesTreatmentAndRepresentativeness>');
  for (const dbRef of dataset.sources.backgroundDatabases) {
    lines.push(renderReference('referenceToDataSource', dbRef, '            '));
  }
  lines.push('        </dataSourcesTreatmentAndRepresentativeness>');

  // Validation
  if (dataset.organisations.verifier) {
    lines.push('        <validation>');
    lines.push('            <review type="Independent external review">');
    lines.push(renderReference('common:referenceToNameOfReviewerAndInstitution', dataset.organisations.verifier, '                '));
    lines.push('            </review>');
    lines.push('        </validation>');
  }

  // Compliance
  if (dataset.complianceDeclarations.length > 0) {
    lines.push('        <complianceDeclarations>');
    for (const comp of dataset.complianceDeclarations) {
      lines.push('            <compliance>');
      lines.push(renderReference('common:referenceToComplianceSystem', comp.system, '                '));
      lines.push('            </compliance>');
    }
    lines.push('        </complianceDeclarations>');
  }

  lines.push('    </modellingAndValidation>');
  return lines.join('\n');
}

function renderAdministrativeInformation(dataset: EPDDataset, config: typeof STANDARD_CONFIGS['+A2/EF3.1']): string {
  const lines: string[] = [];
  lines.push('    <administrativeInformation>');

  if (dataset.organisations.commissioner) {
    lines.push('        <common:commissionerAndGoal>');
    lines.push(renderReference('common:referenceToCommissioner', dataset.organisations.commissioner, '            '));
    lines.push('        </common:commissionerAndGoal>');
  }

  if (dataset.organisations.dataGenerator) {
    lines.push('        <dataGenerator>');
    lines.push(renderReference('common:referenceToPersonOrEntityGeneratingTheDataSet', dataset.organisations.dataGenerator, '            '));
    lines.push('        </dataGenerator>');
  }

  // Data entry
  lines.push('        <dataEntryBy>');
  lines.push(`            <common:timeStamp>${dataset.dataEntryBy.timestamp}</common:timeStamp>`);
  for (const fmt of dataset.dataEntryBy.referenceToDataSetFormat) {
    lines.push(renderReference('common:referenceToDataSetFormat', fmt, '            '));
  }
  lines.push('        </dataEntryBy>');

  // Publication
  const pub = dataset.publicationAndOwnership;
  lines.push('        <publicationAndOwnership>');
  lines.push(`            <common:dataSetVersion>${xmlEscape(pub.dataSetVersion)}</common:dataSetVersion>`);
  lines.push(`            <common:dateOfLastRevision>${pub.dateOfLastRevision}</common:dateOfLastRevision>`);
  if (pub.registrationAuthority) {
    lines.push(renderReference('common:referenceToRegistrationAuthority', pub.registrationAuthority, '            '));
  }
  if (pub.registrationNumber) {
    lines.push(`            <common:registrationNumber>${xmlEscape(pub.registrationNumber)}</common:registrationNumber>`);
  }
  if (pub.referenceToOwner) {
    lines.push(renderReference('common:referenceToOwnershipOfDataSet', pub.referenceToOwner, '            '));
  }
  lines.push(`            <common:copyright>${pub.copyright}</common:copyright>`);
  lines.push(`            <common:licenseType>${xmlEscape(pub.licenseType)}</common:licenseType>`);

  if (pub.referenceToPublisher || pub.referenceToOriginalEPD) {
    lines.push('            <common:other>');
    if (pub.referenceToPublisher) {
      lines.push(renderReference('epd2:referenceToPublisher', pub.referenceToPublisher, '                '));
    }
    if (pub.referenceToOriginalEPD) {
      lines.push(renderReference('epd2:referenceToOriginalEPD', pub.referenceToOriginalEPD, '                '));
    }
    lines.push('            </common:other>');
  }

  lines.push('        </publicationAndOwnership>');
  lines.push('    </administrativeInformation>');
  return lines.join('\n');
}

function renderExchanges(dataset: EPDDataset): string {
  const lines: string[] = [];
  lines.push('    <exchanges>');

  // Reference flow first (no direction, no epd:amounts)
  const refFlowID = dataset.quantitativeReference.referenceToReferenceFlow;
  const refExchange = dataset.exchanges.find(e => e.dataSetInternalID === refFlowID);
  if (!refExchange) {
    // Generate a reference flow exchange from the product flow
    lines.push(`        <exchange dataSetInternalID="${refFlowID}">`);
    lines.push(renderReference('referenceToFlowDataSet', {
      type: 'flow data set',
      refObjectId: dataset.productFlow.uuid,
      shortDescription: dataset.productFlow.name,
    }, '            '));
    lines.push('            <meanAmount>1.0</meanAmount>');
    lines.push('        </exchange>');
  }

  for (const ex of dataset.exchanges) {
    if (ex.dataSetInternalID === refFlowID && !refExchange) continue;
    lines.push(renderExchange(ex, ex.dataSetInternalID === refFlowID));
  }

  lines.push('    </exchanges>');
  return lines.join('\n');
}

function renderExchange(ex: Exchange, isRefFlow: boolean): string {
  const lines: string[] = [];
  lines.push(`        <exchange dataSetInternalID="${ex.dataSetInternalID}">`);
  lines.push(renderReference('referenceToFlowDataSet', ex.flowRef, '            '));

  if (isRefFlow) {
    lines.push(`            <meanAmount>${ex.meanAmount}</meanAmount>`);
    lines.push('        </exchange>');
    return lines.join('\n');
  }

  lines.push('            <functionType>General reminder flow</functionType>');
  lines.push(`            <exchangeDirection>${ex.exchangeDirection}</exchangeDirection>`);
  lines.push(`            <meanAmount>${ex.meanAmount}</meanAmount>`);

  if (ex.amounts.length > 0) {
    lines.push('            <common:other>');
    for (const amt of ex.amounts) {
      const scAttr = amt.scenario ? ` epd:scenario="${xmlEscape(amt.scenario)}"` : '';
      lines.push(`                <epd:amount epd:module="${amt.module}"${scAttr}>${amt.value}</epd:amount>`);
    }
    lines.push(renderReference('epd:referenceToUnitGroupDataSet', ex.unitGroupRef, '                '));
    lines.push('            </common:other>');
  }

  lines.push('        </exchange>');
  return lines.join('\n');
}

function renderLCIAResults(dataset: EPDDataset): string {
  if (dataset.lciaResults.length === 0) return '';

  const lines: string[] = [];
  lines.push('    <LCIAResults>');

  for (const result of dataset.lciaResults) {
    lines.push('        <LCIAResult>');
    lines.push(renderReference('referenceToLCIAMethodDataSet', result.methodRef, '            '));
    lines.push(`            <meanAmount>${result.meanAmount}</meanAmount>`);

    if (result.amounts.length > 0) {
      lines.push('            <common:other>');
      for (const amt of result.amounts) {
        const scAttr = amt.scenario ? ` epd:scenario="${xmlEscape(amt.scenario)}"` : '';
        lines.push(`                <epd:amount epd:module="${amt.module}"${scAttr}>${amt.value}</epd:amount>`);
      }
      lines.push(renderReference('epd:referenceToUnitGroupDataSet', result.unitGroupRef, '                '));
      lines.push('            </common:other>');
    }

    lines.push('        </LCIAResult>');
  }

  lines.push('    </LCIAResults>');
  return lines.join('\n');
}
```

- [ ] **Step 5: Run tests**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/generators/__tests__/process-xml.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add epd-generator/src/generators/
git commit -m "feat: add process XML generator with exchanges, LCIA results, and namespace handling"
```

---

### Task 7: Build ZIP and JSON Generators

**Files:**
- Create: `epd-generator/src/generators/zip-generator.ts`
- Create: `epd-generator/src/generators/json-generator.ts`
- Create: `epd-generator/src/generators/index.ts`
- Test: `epd-generator/src/generators/__tests__/json-generator.test.ts`

- [ ] **Step 1: Write failing test for JSON generator**

Create `src/generators/__tests__/json-generator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateJSON } from '../json-generator';
import { createEmptyDataset } from '../../model/epd-dataset';

describe('generateJSON', () => {
  it('produces valid JSON with indicator short names', () => {
    const dataset = createEmptyDataset();
    dataset.lciaResults = [{
      methodRef: {
        type: 'LCIA method data set',
        refObjectId: 'b2ad6494-c78d-11e6-9d9d-cec0c932ce01',
        shortDescription: [{ lang: 'en', value: 'Abiotic depletion potential - non-fossil resources (ADPE)' }],
      },
      meanAmount: 0.0,
      amounts: [{ module: 'A1-A3', value: 12.5 }],
      unitGroupRef: {
        type: 'unit group data set',
        refObjectId: '54ccd2d9-a32a-4fc2-923d-f2c8c93e89d4',
        shortDescription: [{ lang: 'en', value: 'kg Sb-eqv.' }],
      },
    }];

    const json = generateJSON(dataset);
    const parsed = JSON.parse(json);

    expect(parsed.meta.uuid).toBe(dataset.meta.uuid);
    expect(parsed.lciaResults).toHaveLength(1);
    expect(parsed.lciaResults[0].uuid).toBe('b2ad6494-c78d-11e6-9d9d-cec0c932ce01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/generators/__tests__/json-generator.test.ts
```

- [ ] **Step 3: Implement JSON generator**

Create `src/generators/json-generator.ts`:
```ts
import type { EPDDataset } from '../model/epd-dataset';

export function generateJSON(dataset: EPDDataset): string {
  const output = {
    meta: dataset.meta,
    processInfo: {
      name: dataset.processInfo.name,
      referenceYear: dataset.processInfo.referenceYear,
      validUntil: dataset.processInfo.validUntil,
      location: dataset.processInfo.location,
      scenarios: dataset.processInfo.scenarios,
    },
    productFlow: {
      uuid: dataset.productFlow.uuid,
      name: dataset.productFlow.name,
      materialProperties: dataset.productFlow.materialProperties,
    },
    declaredModules: [...dataset.declaredModules],
    exchanges: dataset.exchanges.map(ex => ({
      uuid: ex.flowRef.refObjectId,
      name: ex.flowRef.shortDescription.find(s => s.lang === 'en')?.value || '',
      direction: ex.exchangeDirection,
      unit: ex.unitGroupRef.shortDescription.find(s => s.lang === 'en')?.value || '',
      amounts: Object.fromEntries(
        ex.amounts.map(a => [
          a.scenario ? `${a.module}|${a.scenario}` : a.module,
          a.value,
        ])
      ),
    })),
    lciaResults: dataset.lciaResults.map(r => ({
      uuid: r.methodRef.refObjectId,
      name: r.methodRef.shortDescription.find(s => s.lang === 'en')?.value || '',
      unit: r.unitGroupRef.shortDescription.find(s => s.lang === 'en')?.value || '',
      amounts: Object.fromEntries(
        r.amounts.map(a => [
          a.scenario ? `${a.module}|${a.scenario}` : a.module,
          a.value,
        ])
      ),
    })),
  };

  return JSON.stringify(output, null, 2);
}
```

- [ ] **Step 4: Implement ZIP generator**

Create `src/generators/zip-generator.ts`:
```ts
import JSZip from 'jszip';
import type { EPDDataset } from '../model/epd-dataset';
import { generateProcessXML } from './xml/process-xml';

export async function generateILCDZip(dataset: EPDDataset): Promise<Blob> {
  const zip = new JSZip();
  const ilcd = zip.folder('ILCD')!;

  // Process dataset
  const processXML = generateProcessXML(dataset);
  ilcd.folder('processes')!.file(`${dataset.meta.uuid}.xml`, processXML);

  // Flow dataset for the product
  ilcd.folder('flows')!.file(`${dataset.productFlow.uuid}.xml`,
    generateFlowXMLStub(dataset));

  return zip.generateAsync({ type: 'blob' });
}

function generateFlowXMLStub(dataset: EPDDataset): string {
  // Minimal flow dataset — full implementation in a later task
  return `<?xml version="1.0" encoding="UTF-8"?>
<flowDataSet xmlns="http://lca.jrc.it/ILCD/Flow" xmlns:common="http://lca.jrc.it/ILCD/Common" version="1.1">
    <flowInformation>
        <dataSetInformation>
            <common:UUID>${dataset.productFlow.uuid}</common:UUID>
            <name>
                <baseName xml:lang="en">${dataset.productFlow.name.find(n => n.lang === 'en')?.value || ''}</baseName>
            </name>
        </dataSetInformation>
    </flowInformation>
</flowDataSet>`;
}
```

Create `src/generators/index.ts`:
```ts
export { generateProcessXML } from './xml/process-xml';
export { generateJSON } from './json-generator';
export { generateILCDZip } from './zip-generator';
```

- [ ] **Step 5: Run all generator tests**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/generators/
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add epd-generator/src/generators/
git commit -m "feat: add JSON and ILCD ZIP generators"
```

---

## Chunk 4: Wizard UI

> This chunk covers the wizard shell and all 7 step components. The UI connects to the Zustand store and uses the schema registry to render dynamic forms.
>
> **Note:** Full form field implementations are included for Steps 1-2 and 5 (the most critical). Steps 3-4 and 6 follow the same patterns. Step 7 ties it all together with validation and export.

### Task 8: Wizard Shell & Routing

**Files:**
- Create: `epd-generator/src/components/WizardShell.tsx`
- Create: `epd-generator/src/components/WizardStepIndicator.tsx`
- Modify: `epd-generator/src/App.tsx`

- [ ] **Step 1: Create the wizard step indicator**

Create `src/components/WizardStepIndicator.tsx`:
```tsx
const STEPS = [
  { label: 'Standard & Type', short: '1' },
  { label: 'Product Info', short: '2' },
  { label: 'Product Flow', short: '3' },
  { label: 'Organisations', short: '4' },
  { label: 'Lifecycle Modules', short: '5' },
  { label: 'Sources', short: '6' },
  { label: 'Review & Export', short: '7' },
];

interface Props {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export function WizardStepIndicator({ currentStep, onStepClick }: Props) {
  return (
    <nav className="flex items-center justify-between mb-8" aria-label="Wizard steps">
      {STEPS.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        return (
          <button
            key={i}
            onClick={() => onStepClick(i)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${isActive ? 'bg-blue-600 text-white' : ''}
              ${isCompleted ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : ''}
              ${!isActive && !isCompleted ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : ''}
            `}
            aria-current={isActive ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${step.label}`}
          >
            <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
              ${isActive ? 'bg-white text-blue-600' : ''}
              ${isCompleted ? 'bg-blue-600 text-white' : ''}
              ${!isActive && !isCompleted ? 'bg-gray-300 text-gray-600' : ''}
            `}>
              {isCompleted ? '\u2713' : step.short}
            </span>
            <span className="hidden lg:inline">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create wizard shell**

Create `src/components/WizardShell.tsx`:
```tsx
import { lazy, Suspense } from 'react';
import { useEPDStore } from '../store';
import { WizardStepIndicator } from './WizardStepIndicator';

const Step1StandardType = lazy(() => import('./steps/Step1StandardType'));
const Step2ProductInfo = lazy(() => import('./steps/Step2ProductInfo'));
const Step3ProductFlow = lazy(() => import('./steps/Step3ProductFlow'));
const Step4Organisations = lazy(() => import('./steps/Step4Organisations'));
const Step5LifecycleModules = lazy(() => import('./steps/Step5LifecycleModules'));
const Step6Sources = lazy(() => import('./steps/Step6Sources'));
const Step7ReviewExport = lazy(() => import('./steps/Step7ReviewExport'));

const STEP_COMPONENTS = [
  Step1StandardType,
  Step2ProductInfo,
  Step3ProductFlow,
  Step4Organisations,
  Step5LifecycleModules,
  Step6Sources,
  Step7ReviewExport,
];

export function WizardShell() {
  const currentStep = useEPDStore((s) => s.currentStep);
  const setStep = useEPDStore((s) => s.setStep);

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div>
      <WizardStepIndicator currentStep={currentStep} onStepClick={setStep} />
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <Suspense fallback={<div className="animate-pulse h-64 bg-gray-100 rounded" />}>
          <StepComponent />
        </Suspense>
      </div>
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-6 py-2 rounded-lg border text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => setStep(Math.min(6, currentStep + 1))}
          disabled={currentStep === 6}
          className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentStep === 5 ? 'Review' : 'Next'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update App.tsx**

Replace `src/App.tsx`:
```tsx
import { WizardShell } from './components/WizardShell';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">EPD Generator</h1>
          <p className="text-sm text-gray-500">ILCD+EPD v1.3 Dataset Creator</p>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <WizardShell />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create placeholder step components**

Create stubs for each step in `src/components/steps/`. Each is a default export:

`src/components/steps/Step1StandardType.tsx` through `Step7ReviewExport.tsx`:

Each stub follows this pattern (replace N and name):
```tsx
export default function StepNName() {
  return <div><h2 className="text-xl font-semibold mb-4">Step N: Name</h2><p>Coming soon</p></div>;
}
```

- [ ] **Step 5: Verify app runs with wizard navigation**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npm run dev
```

Expected: Wizard shows 7 steps, Previous/Next buttons work, step indicator highlights correctly.

- [ ] **Step 6: Commit**

```bash
git add epd-generator/src/components/ epd-generator/src/App.tsx
git commit -m "feat: add wizard shell with step navigation and lazy-loaded step components"
```

---

### Task 9: Implement Step 1 — Standard & Type

**Files:**
- Modify: `epd-generator/src/components/steps/Step1StandardType.tsx`

- [ ] **Step 1: Implement Step 1**

```tsx
import { useEPDStore } from '../../store';
import { STANDARD_CONFIGS, EPD_SUB_TYPES } from '../../schema/standard-configs';
import type { StandardVersion, EPDSubType } from '../../schema/types';

const STANDARD_OPTIONS: Array<{ value: StandardVersion; label: string; description: string }> = [
  { value: '+A1', label: 'EN 15804+A1', description: '24 indicators, basic scenarios' },
  { value: '+A2/EF3.0', label: 'EN 15804+A2 (EF 3.0)', description: '37 indicators, content declaration' },
  { value: '+A2/EF3.1', label: 'EN 15804+A2 (EF 3.1)', description: '37 indicators, full v1.3 features (service life, SVHC, manufacturer sites)' },
];

export default function Step1StandardType() {
  const standardVersion = useEPDStore((s) => s.dataset.meta.standardVersion);
  const subType = useEPDStore((s) => s.dataset.meta.subType);
  const setStandardVersion = useEPDStore((s) => s.setStandardVersion);
  const updateDataset = useEPDStore((s) => s.updateDataset);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Standard Version</h2>
        <p className="text-sm text-gray-500 mb-4">Select the EN 15804 standard version. This determines which indicators, namespaces, and features are available.</p>
        <div className="grid gap-3">
          {STANDARD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors
                ${standardVersion === opt.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <input
                type="radio"
                name="standardVersion"
                value={opt.value}
                checked={standardVersion === opt.value}
                onChange={() => setStandardVersion(opt.value)}
                className="mt-1"
                aria-label={opt.label}
              />
              <div>
                <div className="font-medium">{opt.label}</div>
                <div className="text-sm text-gray-500">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">EPD Sub-Type</h2>
        <select
          value={subType}
          onChange={(e) => updateDataset({ meta: { ...useEPDStore.getState().dataset.meta, subType: e.target.value as EPDSubType } })}
          className="w-full p-3 border rounded-lg text-gray-900 bg-white"
          aria-label="EPD sub-type"
        >
          {EPD_SUB_TYPES.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Selected Configuration</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">Namespaces:</dt>
          <dd>{STANDARD_CONFIGS[standardVersion].namespaces.length} EPD extension(s)</dd>
          <dt className="text-gray-500">Content Declaration:</dt>
          <dd>{STANDARD_CONFIGS[standardVersion].features.contentDeclaration ? 'Yes' : 'No'}</dd>
          <dt className="text-gray-500">Service Life:</dt>
          <dd>{STANDARD_CONFIGS[standardVersion].features.serviceLife ? 'Yes' : 'No'}</dd>
          <dt className="text-gray-500">SVHC Tracking:</dt>
          <dd>{STANDARD_CONFIGS[standardVersion].features.svhc ? 'Yes' : 'No'}</dd>
        </dl>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npm run dev
```

Expected: Step 1 shows radio buttons for standard version, dropdown for sub-type, and configuration summary.

- [ ] **Step 3: Commit**

```bash
git add epd-generator/src/components/steps/Step1StandardType.tsx
git commit -m "feat: implement Step 1 - Standard & Type selection"
```

---

### Task 10: Implement Step 5 — Lifecycle Modules (Core Data Entry)

**Files:**
- Modify: `epd-generator/src/components/steps/Step5LifecycleModules.tsx`
- Create: `epd-generator/src/components/steps/IndicatorMatrix.tsx`

> Step 5 is the most complex and important step — it renders the module x indicator matrix. Building it now proves the schema registry integration works end-to-end.

- [ ] **Step 1: Create the indicator matrix component**

Create `src/components/steps/IndicatorMatrix.tsx`:
```tsx
import type { Indicator, ModuleName } from '../../schema/types';
import type { Exchange, LCIAResult } from '../../model/epd-dataset';

interface Props {
  title: string;
  indicators: Indicator[];
  modules: ModuleName[];
  values: Map<string, Map<string, number>>; // indicatorUUID -> module -> value
  onChange: (indicatorUuid: string, module: ModuleName, value: number) => void;
}

export function IndicatorMatrix({ title, indicators, modules, values, onChange }: Props) {
  return (
    <div className="overflow-x-auto">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700 border">Indicator</th>
            <th className="px-2 py-2 text-left font-medium text-gray-500 border">Unit</th>
            {modules.map(m => (
              <th key={m} className="px-2 py-2 text-center font-medium text-gray-700 border min-w-[80px]">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicators.map(ind => {
            // Extract short name from parentheses, e.g. "Global Warming Potential (GWP)" -> "GWP"
            const shortMatch = ind.nameEn.match(/\(([^)]+)\)\s*$/);
            const shortName = shortMatch ? shortMatch[1] : ind.nameEn;

            return (
              <tr key={ind.uuid} className="hover:bg-blue-50">
                <td className="sticky left-0 bg-white px-3 py-1 border font-medium" title={ind.nameEn}>
                  {shortName}
                </td>
                <td className="px-2 py-1 border text-gray-500 text-xs">{ind.unitEn}</td>
                {modules.map(mod => {
                  const val = values.get(ind.uuid)?.get(mod);
                  return (
                    <td key={mod} className="px-1 py-1 border">
                      <input
                        type="number"
                        step="any"
                        value={val ?? ''}
                        onChange={(e) => onChange(ind.uuid, mod, parseFloat(e.target.value) || 0)}
                        className="w-full px-1 py-0.5 text-right text-sm border rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        aria-label={`${shortName} for module ${mod}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Implement Step 5**

Modify `src/components/steps/Step5LifecycleModules.tsx`:
```tsx
import { useMemo, useCallback } from 'react';
import { useEPDStore } from '../../store';
import { SchemaRegistry } from '../../schema/registry';
import { ALL_MODULES } from '../../schema/standard-configs';
import { IndicatorMatrix } from './IndicatorMatrix';
import type { ModuleName } from '../../schema/types';

// Note: In production, the registry would be initialized once at app level.
// For now, create it lazily. This will be refactored when we add the
// build-time schema loading in a later task.
let _registry: ReturnType<typeof SchemaRegistry.create> | null = null;
function getRegistry() {
  if (!_registry) _registry = SchemaRegistry.create();
  return _registry;
}

export default function Step5LifecycleModules() {
  const standardVersion = useEPDStore((s) => s.dataset.meta.standardVersion);
  const declaredModules = useEPDStore((s) => s.dataset.declaredModules);
  const exchanges = useEPDStore((s) => s.dataset.exchanges);
  const lciaResults = useEPDStore((s) => s.dataset.lciaResults);
  const toggleModule = useEPDStore((s) => s.toggleModule);
  const updateDataset = useEPDStore((s) => s.updateDataset);

  const registry = getRegistry();
  const indicatorSet = registry.getIndicatorSet(standardVersion);
  const activeModules = useMemo(() =>
    ALL_MODULES.filter(m => declaredModules.has(m)),
    [declaredModules]
  );

  // Build value maps from exchanges/lciaResults
  const exchangeValues = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const ex of exchanges) {
      const indMap = new Map<string, number>();
      for (const amt of ex.amounts) {
        indMap.set(amt.module, amt.value);
      }
      map.set(ex.flowRef.refObjectId, indMap);
    }
    return map;
  }, [exchanges]);

  const lciaValues = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of lciaResults) {
      const indMap = new Map<string, number>();
      for (const amt of r.amounts) {
        indMap.set(amt.module, amt.value);
      }
      map.set(r.methodRef.refObjectId, indMap);
    }
    return map;
  }, [lciaResults]);

  const handleExchangeChange = useCallback((indicatorUuid: string, module: ModuleName, value: number) => {
    const indicator = indicatorSet.exchanges.find(i => i.uuid === indicatorUuid);
    if (!indicator) return;

    const existing = exchanges.find(e => e.flowRef.refObjectId === indicatorUuid);
    if (existing) {
      const newAmounts = [...existing.amounts.filter(a => a.module !== module), { module, value }];
      const newExchanges = exchanges.map(e =>
        e.flowRef.refObjectId === indicatorUuid ? { ...e, amounts: newAmounts } : e
      );
      updateDataset({ exchanges: newExchanges });
    } else {
      // Determine direction: resource use = Input, waste/output = Output
      const isInput = indicator.nameEn.includes('Use of') || indicator.nameEn.includes('net fresh water');
      const newExchange = {
        dataSetInternalID: 42 + exchanges.length + 1,
        flowRef: {
          type: 'flow data set',
          refObjectId: indicatorUuid,
          shortDescription: [{ lang: 'en', value: indicator.nameEn }],
        },
        exchangeDirection: (isInput ? 'Input' : 'Output') as 'Input' | 'Output',
        meanAmount: 0.0,
        amounts: [{ module, value }],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: indicator.unitGroupUuid,
          shortDescription: [{ lang: 'en', value: indicator.unitEn }],
        },
      };
      updateDataset({ exchanges: [...exchanges, newExchange] });
    }
  }, [exchanges, indicatorSet, updateDataset]);

  const handleLCIAChange = useCallback((indicatorUuid: string, module: ModuleName, value: number) => {
    const indicator = indicatorSet.lcia.find(i => i.uuid === indicatorUuid);
    if (!indicator) return;

    const existing = lciaResults.find(r => r.methodRef.refObjectId === indicatorUuid);
    if (existing) {
      const newAmounts = [...existing.amounts.filter(a => a.module !== module), { module, value }];
      const newResults = lciaResults.map(r =>
        r.methodRef.refObjectId === indicatorUuid ? { ...r, amounts: newAmounts } : r
      );
      updateDataset({ lciaResults: newResults });
    } else {
      const newResult = {
        methodRef: {
          type: 'LCIA method data set',
          refObjectId: indicatorUuid,
          shortDescription: [{ lang: 'en', value: indicator.nameEn }],
        },
        meanAmount: 0.0,
        amounts: [{ module, value }],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: indicator.unitGroupUuid,
          shortDescription: [{ lang: 'en', value: indicator.unitEn }],
        },
      };
      updateDataset({ lciaResults: [...lciaResults, newResult] });
    }
  }, [lciaResults, indicatorSet, updateDataset]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-4">Declared Lifecycle Modules</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_MODULES.map(m => (
            <button
              key={m}
              onClick={() => toggleModule(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                ${declaredModules.has(m) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}
              aria-pressed={declaredModules.has(m)}
              aria-label={`Module ${m}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {activeModules.length > 0 && (
        <>
          <IndicatorMatrix
            title="LCI Indicators (Exchanges)"
            indicators={indicatorSet.exchanges}
            modules={activeModules}
            values={exchangeValues}
            onChange={handleExchangeChange}
          />
          <IndicatorMatrix
            title="LCIA Impact Indicators"
            indicators={indicatorSet.lcia}
            modules={activeModules}
            values={lciaValues}
            onChange={handleLCIAChange}
          />
        </>
      )}

      {activeModules.length === 0 && (
        <p className="text-gray-500 italic">Select at least one lifecycle module to enter indicator values.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Navigate to Step 5 in the wizard. Toggle modules on/off. Verify indicator tables appear with the correct indicators for the selected standard version (change in Step 1, come back to Step 5).

- [ ] **Step 4: Commit**

```bash
git add epd-generator/src/components/steps/Step5LifecycleModules.tsx epd-generator/src/components/steps/IndicatorMatrix.tsx
git commit -m "feat: implement Step 5 - lifecycle module selection and indicator matrix"
```

---

### Task 11: Implement Step 7 — Review & Export

**Files:**
- Modify: `epd-generator/src/components/steps/Step7ReviewExport.tsx`

- [ ] **Step 1: Implement Step 7**

```tsx
import { useState } from 'react';
import { useEPDStore } from '../../store';
import { generateProcessXML } from '../../generators/xml/process-xml';
import { generateJSON } from '../../generators/json-generator';
import { generateILCDZip } from '../../generators/zip-generator';

export default function Step7ReviewExport() {
  const dataset = useEPDStore((s) => s.dataset);
  const [exportStatus, setExportStatus] = useState<string>('');

  const handleExportXML = () => {
    const xml = generateProcessXML(dataset);
    downloadFile(`${dataset.meta.uuid}.xml`, xml, 'application/xml');
    setExportStatus('XML exported successfully');
  };

  const handleExportJSON = () => {
    const json = generateJSON(dataset);
    downloadFile(`${dataset.meta.uuid}.json`, json, 'application/json');
    setExportStatus('JSON exported successfully');
  };

  const handleExportZIP = async () => {
    setExportStatus('Generating ZIP...');
    const blob = await generateILCDZip(dataset);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ILCD_${dataset.meta.uuid}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus('ILCD ZIP exported successfully');
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Review & Export</h2>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Dataset Info</h3>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-gray-500">UUID:</dt><dd className="font-mono text-xs">{dataset.meta.uuid}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Standard:</dt><dd>{dataset.meta.standardVersion}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Sub-Type:</dt><dd>{dataset.meta.subType}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Version:</dt><dd>{dataset.meta.dataSetVersion}</dd></div>
          </dl>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Product</h3>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-gray-500">Name:</dt><dd>{dataset.processInfo.name.find(n => n.lang === 'en')?.value || '(not set)'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Location:</dt><dd>{dataset.processInfo.location || '(not set)'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Year:</dt><dd>{dataset.processInfo.referenceYear}</dd></div>
          </dl>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Modules</h3>
          <p>{dataset.declaredModules.size > 0 ? [...dataset.declaredModules].join(', ') : '(none declared)'}</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium mb-2">Data</h3>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt className="text-gray-500">Exchanges:</dt><dd>{dataset.exchanges.length}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">LCIA Results:</dt><dd>{dataset.lciaResults.length}</dd></div>
          </dl>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Export</h3>
        <div className="flex gap-3">
          <button onClick={handleExportXML} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Export XML
          </button>
          <button onClick={handleExportZIP} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Export ILCD ZIP
          </button>
          <button onClick={handleExportJSON} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Export JSON
          </button>
        </div>
        {exportStatus && <p className="mt-2 text-sm text-green-600">{exportStatus}</p>}
      </div>
    </div>
  );
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verify in browser**

Navigate through wizard to Step 7. Click export buttons. Verify XML, JSON, and ZIP files download.

- [ ] **Step 3: Commit**

```bash
git add epd-generator/src/components/steps/Step7ReviewExport.tsx
git commit -m "feat: implement Step 7 - review summary and XML/JSON/ZIP export"
```

---

### Task 12: Implement Remaining Steps (2, 3, 4, 6)

**Files:**
- Modify: `epd-generator/src/components/steps/Step2ProductInfo.tsx`
- Modify: `epd-generator/src/components/steps/Step3ProductFlow.tsx`
- Modify: `epd-generator/src/components/steps/Step4Organisations.tsx`
- Modify: `epd-generator/src/components/steps/Step6Sources.tsx`

> These steps follow the same pattern: read from store, render form fields, write back to store on change. Implement each following the field mappings from the spec. Each step should:
> - Read the relevant portion of `dataset` from the store
> - Render labeled form fields with appropriate input types
> - Use `updateProcessInfo`, `updateProductFlow`, `updateOrganisations`, or `updateSources` to persist changes
> - Show/hide fields based on `STANDARD_CONFIGS[standardVersion].features`

- [ ] **Step 1: Implement Step 2 — Product Info**

Key fields: product name (multilingual), classification, declared unit (dropdown of flow properties from registry), reference year, valid until, location, technology description. Conditionally show service life fields for +A2.

- [ ] **Step 2: Implement Step 3 — Product Flow**

Key fields: product flow name, material properties (dropdown of supported MatML properties + value), content declaration (materials list with add/remove, substances with SVHC/CAS/EC fields). Conditional on `features.contentDeclaration`.

- [ ] **Step 3: Implement Step 4 — Organisations**

Key fields: manufacturer contacts (add/remove, with site details for +A2/EF3.1), programme operator, LCA consultant, verifier, data owner. Each is a reference with UUID, name, and optional site info.

- [ ] **Step 4: Implement Step 6 — Sources**

Key fields: PCR reference, background database (dropdown of GaBi/ecoinvent from Common_references.csv), EPD document, reference to original EPD (conditional), verification report.

- [ ] **Step 5: Verify all steps in browser**

Navigate through all 7 steps. Verify fields appear/disappear based on standard version selection.

- [ ] **Step 6: Commit**

```bash
git add epd-generator/src/components/steps/
git commit -m "feat: implement Steps 2-4, 6 - product info, flow, organisations, sources"
```

---

## Chunk 5: Validation & Polish

### Task 13: Implement Validation Engine

**Files:**
- Create: `epd-generator/src/validation/validator.ts`
- Create: `epd-generator/src/validation/types.ts`
- Test: `epd-generator/src/validation/__tests__/validator.test.ts`

- [ ] **Step 1: Define validation types**

Create `src/validation/types.ts`:
```ts
export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  step: number;       // wizard step index (0-6)
  field: string;      // field identifier for click-to-fix
  message: string;
}

export interface ValidationResult {
  valid: boolean;     // true if no errors (warnings OK)
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
```

- [ ] **Step 2: Write failing test**

Create `src/validation/__tests__/validator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateDataset } from '../validator';
import { createEmptyDataset } from '../../model/epd-dataset';

describe('validateDataset', () => {
  it('reports error for missing product name', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'processInfo.name')).toBe(true);
  });

  it('reports error for no declared modules', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'declaredModules')).toBe(true);
  });

  it('passes for a minimally valid dataset', () => {
    const dataset = createEmptyDataset();
    dataset.processInfo.name = [{ lang: 'en', value: 'Test Product' }];
    dataset.processInfo.location = 'DE';
    dataset.declaredModules = new Set(['A1-A3']);
    dataset.exchanges = [{
      dataSetInternalID: 43,
      flowRef: { type: 'flow data set', refObjectId: '20f32be5-0398-4288-9b6d-accddd195317', shortDescription: [{ lang: 'en', value: 'PERE' }] },
      exchangeDirection: 'Input',
      meanAmount: 0,
      amounts: [{ module: 'A1-A3', value: 1.0 }],
      unitGroupRef: { type: 'unit group data set', refObjectId: '93a60a57-a3c8-11da-a746-0800200c9a66', shortDescription: [{ lang: 'en', value: 'MJ' }] },
    }];
    // Errors may still exist for missing indicators, but name/location/modules should not be flagged
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'processInfo.name')).toBe(false);
    expect(result.errors.some(e => e.field === 'declaredModules')).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/validation/__tests__/validator.test.ts
```

- [ ] **Step 4: Implement validator**

Create `src/validation/validator.ts`:
```ts
import type { EPDDataset } from '../model/epd-dataset';
import type { ValidationResult, ValidationIssue } from './types';

export function validateDataset(dataset: EPDDataset): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Step 1 validations
  if (!dataset.meta.standardVersion) {
    issues.push({ severity: 'error', step: 0, field: 'meta.standardVersion', message: 'Standard version is required' });
  }

  // Step 2 validations
  const hasName = dataset.processInfo.name.some(n => n.value.trim().length > 0);
  if (!hasName) {
    issues.push({ severity: 'error', step: 1, field: 'processInfo.name', message: 'Product name is required (at least one language)' });
  }

  if (!dataset.processInfo.location) {
    issues.push({ severity: 'warning', step: 1, field: 'processInfo.location', message: 'Location is recommended' });
  }

  if (!dataset.processInfo.referenceYear) {
    issues.push({ severity: 'error', step: 1, field: 'processInfo.referenceYear', message: 'Reference year is required' });
  }

  // Step 3 validations
  if (!dataset.productFlow.name.some(n => n.value.trim())) {
    issues.push({ severity: 'warning', step: 2, field: 'productFlow.name', message: 'Product flow name is recommended' });
  }

  // Step 5 validations
  if (dataset.declaredModules.size === 0) {
    issues.push({ severity: 'error', step: 4, field: 'declaredModules', message: 'At least one lifecycle module must be declared' });
  }

  if (dataset.exchanges.length === 0 && dataset.declaredModules.size > 0) {
    issues.push({ severity: 'warning', step: 4, field: 'exchanges', message: 'No exchange indicators have values' });
  }

  if (dataset.lciaResults.length === 0 && dataset.declaredModules.size > 0) {
    issues.push({ severity: 'warning', step: 4, field: 'lciaResults', message: 'No LCIA indicators have values' });
  }

  // Step 6 validations
  if (!dataset.sources.pcr) {
    issues.push({ severity: 'warning', step: 5, field: 'sources.pcr', message: 'PCR reference is recommended' });
  }

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}
```

- [ ] **Step 5: Run tests**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run src/validation/
```

Expected: All tests PASS.

- [ ] **Step 6: Integrate validation into Step 7**

Add validation display to `Step7ReviewExport.tsx` — show errors in red, warnings in yellow, with step + field references. Disable export buttons if errors exist.

- [ ] **Step 7: Commit**

```bash
git add epd-generator/src/validation/ epd-generator/src/components/steps/Step7ReviewExport.tsx
git commit -m "feat: add validation engine with error/warning distinction and integrate into Step 7"
```

---

### Task 14: Run Full Test Suite & Final Polish

- [ ] **Step 1: Run all tests**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 2: Build for production**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 3: Manual smoke test**

1. Open dev server
2. Select EN 15804+A2 (EF 3.1)
3. Fill in product name "Test Wood Panel"
4. Navigate to Step 5, toggle A1-A3 and C3
5. Enter a few indicator values
6. Go to Step 7, verify review summary
7. Export XML — open it, verify it has correct namespaces, exchanges, and LCIAResults
8. Export JSON — verify it's valid JSON with indicator data
9. Export ZIP — verify it contains ILCD/processes/ and ILCD/flows/

- [ ] **Step 4: Final commit**

```bash
git add epd-generator/
git commit -m "feat: complete EPD generator v1 with wizard, schema registry, and export"
```

---

## Chunk 6: Browser-Compatible Schema Loading & Missing Features

### Task 15: Vite Plugin for Build-Time CSV Import

> The SchemaRegistry uses Node `fs` which doesn't work in browsers. Create a Vite plugin that imports CSV files as strings at build time, and a browser-compatible registry.

**Files:**
- Create: `epd-generator/src/schema/csv-imports.ts`
- Create: `epd-generator/src/schema/browser-registry.ts`
- Modify: `epd-generator/vite.config.ts`
- Modify: `epd-generator/src/components/steps/Step5LifecycleModules.tsx`

- [ ] **Step 1: Create CSV import module**

Create `src/schema/csv-imports.ts` that imports CSVs as raw strings:
```ts
// These imports use Vite's ?raw suffix to import file content as strings at build time
import a1CSV from '../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A1_indicators.csv?raw';
import a2ef30CSV from '../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A2_EF3.0_indicators.csv?raw';
import a2ef31CSV from '../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A2_EF3.1_indicators.csv?raw';
import commonRefsCSV from '../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Common_references.csv?raw';
import flowPropsCSV from '../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Flow_properties_and_unit_groups.csv?raw';
import countryCSV from '../../ILCD-EPD-Data-Format-release-v1.3/ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Country-specific_indicators.csv?raw';

export const CSV_DATA = {
  'EN15804+A1_indicators.csv': a1CSV,
  'EN15804+A2_EF3.0_indicators.csv': a2ef30CSV,
  'EN15804+A2_EF3.1_indicators.csv': a2ef31CSV,
  'Common_references.csv': commonRefsCSV,
  'Flow_properties_and_unit_groups.csv': flowPropsCSV,
  'Country-specific_indicators.csv': countryCSV,
} as const;
```

- [ ] **Step 2: Create browser-compatible registry**

Create `src/schema/browser-registry.ts`:
```ts
import type { StandardVersion, IndicatorSet, CountryIndicator } from './types';
import type { StandardConfig } from './standard-configs';
import { STANDARD_CONFIGS } from './standard-configs';
import { parseIndicatorCSV, parseCountryIndicatorCSV, parseCommonReferencesCSV, parseFlowPropertiesCSV } from './indicator-parser';
import { CSV_DATA } from './csv-imports';

export class BrowserSchemaRegistry {
  private indicatorSets: Map<StandardVersion, IndicatorSet>;
  private commonRefs: ReturnType<typeof parseCommonReferencesCSV>;
  private flowProps: ReturnType<typeof parseFlowPropertiesCSV>;
  private countryIndicators: CountryIndicator[];

  constructor() {
    this.indicatorSets = new Map();

    for (const config of Object.values(STANDARD_CONFIGS)) {
      const csv = CSV_DATA[config.indicatorCsvFile as keyof typeof CSV_DATA];
      this.indicatorSets.set(config.version, parseIndicatorCSV(csv, config.version));
    }

    this.commonRefs = parseCommonReferencesCSV(CSV_DATA['Common_references.csv']);
    this.flowProps = parseFlowPropertiesCSV(CSV_DATA['Flow_properties_and_unit_groups.csv']);
    this.countryIndicators = parseCountryIndicatorCSV(CSV_DATA['Country-specific_indicators.csv']);
  }

  getIndicatorSet(version: StandardVersion): IndicatorSet {
    const set = this.indicatorSets.get(version);
    if (!set) throw new Error(`Unknown standard version: ${version}`);
    return set;
  }

  getConfig(version: StandardVersion): StandardConfig {
    return STANDARD_CONFIGS[version];
  }

  getCommonReferences() { return this.commonRefs; }
  getFlowProperties() { return this.flowProps; }
  getCountryIndicators() { return this.countryIndicators; }

  getAvailableCountries(): string[] {
    const countries = new Set<string>();
    for (const ind of this.countryIndicators) {
      for (const c of ind.countries) countries.add(c);
    }
    return [...countries].sort();
  }

  getCountryIndicatorsFor(country: string) {
    return this.countryIndicators.filter(i => i.countries.includes(country));
  }
}

// Singleton instance
let _instance: BrowserSchemaRegistry | null = null;
export function getRegistry(): BrowserSchemaRegistry {
  if (!_instance) _instance = new BrowserSchemaRegistry();
  return _instance;
}
```

- [ ] **Step 3: Update Step 5 to use browser registry**

Replace the `getRegistry()` function in `Step5LifecycleModules.tsx` with:
```ts
import { getRegistry } from '../../schema/browser-registry';
```

- [ ] **Step 4: Add Vite raw import type declaration**

Create `src/vite-env.d.ts` or add to existing:
```ts
/// <reference types="vite/client" />
declare module '*.csv?raw' {
  const content: string;
  export default content;
}
```

- [ ] **Step 5: Verify app works in browser with CSV data**

```bash
cd /c/Users/SteveDev/ILCD-EPD-Data-Format-release-v1.3/epd-generator
npm run dev
```

Navigate to Step 5 — indicator tables should render with data from CSVs.

- [ ] **Step 6: Commit**

```bash
git add epd-generator/src/schema/ epd-generator/src/vite-env.d.ts
git commit -m "feat: add browser-compatible schema registry with Vite raw CSV imports"
```

---

### Task 16: Add Country-Specific Indicator UI to Step 1 & Step 5

**Files:**
- Modify: `epd-generator/src/components/steps/Step1StandardType.tsx`
- Modify: `epd-generator/src/components/steps/Step5LifecycleModules.tsx`
- Modify: `epd-generator/src/store/epd-store.ts`

- [ ] **Step 1: Add country selection to store**

Add `selectedCountry: string | null` to the store state and a `setCountry` action.

- [ ] **Step 2: Add country dropdown to Step 1**

After the EPD Sub-Type selector, add:
```tsx
<div>
  <h2 className="text-xl font-semibold mb-4">Country-Specific Indicators (Optional)</h2>
  <select
    value={selectedCountry || ''}
    onChange={(e) => setCountry(e.target.value || null)}
    className="w-full p-3 border rounded-lg"
    aria-label="Country-specific indicator profile"
  >
    <option value="">None</option>
    {getRegistry().getAvailableCountries().map(c => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Render country indicators in Step 5**

After the LCIA indicator matrix, if a country is selected, render a third matrix:
```tsx
{selectedCountry && (
  <IndicatorMatrix
    title={`Country-Specific Indicators (${selectedCountry})`}
    indicators={registry.getCountryIndicatorsFor(selectedCountry)}
    modules={activeModules}
    values={countryValues}
    onChange={handleCountryIndicatorChange}
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add epd-generator/src/components/steps/ epd-generator/src/store/
git commit -m "feat: add country-specific indicator selection to Steps 1 and 5"
```

---

### Task 17: Add Inline Field Validation

**Files:**
- Create: `epd-generator/src/validation/field-rules.ts`
- Create: `epd-generator/src/components/FieldWrapper.tsx`

- [ ] **Step 1: Define field-level validation rules**

Create `src/validation/field-rules.ts`:
```ts
export interface FieldRule {
  required?: boolean;
  minLength?: number;
  pattern?: RegExp;
  message: string;
}

export const FIELD_RULES: Record<string, FieldRule> = {
  'processInfo.name': { required: true, minLength: 1, message: 'Product name is required' },
  'processInfo.location': { required: true, minLength: 1, message: 'Location is required' },
  'processInfo.referenceYear': { required: true, message: 'Reference year is required' },
  'meta.dataSetVersion': { required: true, pattern: /^\d{2}\.\d{2}\.\d{3}$/, message: 'Version must be in format 00.01.000' },
};

export function validateField(fieldId: string, value: any): string | null {
  const rule = FIELD_RULES[fieldId];
  if (!rule) return null;

  if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return rule.message;
  }
  if (rule.minLength && typeof value === 'string' && value.length < rule.minLength) {
    return rule.message;
  }
  if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
    return rule.message;
  }
  return null;
}
```

- [ ] **Step 2: Create FieldWrapper component for inline errors**

Create `src/components/FieldWrapper.tsx`:
```tsx
import { useState } from 'react';
import { validateField } from '../validation/field-rules';

interface Props {
  fieldId: string;
  label: string;
  children: (props: { onBlur: () => void; hasError: boolean }) => React.ReactNode;
}

export function FieldWrapper({ fieldId, label, children }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const handleBlur = () => {
    setTouched(true);
    // Re-validate on blur — the actual value check happens in the parent
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children({ onBlur: handleBlur, hasError: touched && !!error })}
      {touched && error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add epd-generator/src/validation/ epd-generator/src/components/
git commit -m "feat: add inline field validation with FieldWrapper component"
```
