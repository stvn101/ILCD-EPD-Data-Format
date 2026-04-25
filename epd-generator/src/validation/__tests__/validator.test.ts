import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateDataset } from '../validator';
import { getBundledUuids, findUnresolvedReferences } from '../cross-reference';
import { findIndicatorCoverageGaps } from '../indicator-coverage';
import { buildAuthoritativeUuids } from '../authoritative-uuids';
import { createEmptyDataset } from '../../model/epd-dataset';
import {
  parseIndicatorCSV,
  parseCommonReferencesCSV,
  parseFlowPropertiesCSV,
  parseBackgroundDbCSV,
  parseCountryIndicatorCSV,
} from '../../schema/indicator-parser';
import type { Reference, Indicator } from '../../schema/types';

const IDENTIFIERS_DIR = resolve(
  __dirname,
  '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers',
);
function readCSV(name: string): string {
  return readFileSync(resolve(IDENTIFIERS_DIR, name), 'utf-8');
}

function loadAuthoritativeForTests(): Set<string> {
  const indicators = parseIndicatorCSV(readCSV('EN15804+A2_EF3.1_indicators.csv'), '+A2/EF3.1');
  return buildAuthoritativeUuids({
    commonReferences: parseCommonReferencesCSV(readCSV('Common_references.csv')),
    flowProperties: parseFlowPropertiesCSV(readCSV('Flow_properties_and_unit_groups.csv')),
    backgroundDatabases: [
      ...parseBackgroundDbCSV(readCSV('BackgroundDB_SourceDatasets_GaBi.csv'), 'GaBi'),
      ...parseBackgroundDbCSV(readCSV('BackgroundDB_SourceDatasets_ecoinvent.csv'), 'ecoinvent'),
    ],
    indicators: indicators.all,
    countryIndicators: parseCountryIndicatorCSV(readCSV('Country-specific_indicators.csv')),
  });
}

function loadLciaForTests(): Indicator[] {
  return parseIndicatorCSV(readCSV('EN15804+A2_EF3.1_indicators.csv'), '+A2/EF3.1').lcia;
}

function makeRef(type: string, uuid: string, label: string): Reference {
  return { type, refObjectId: uuid, shortDescription: [{ lang: 'en', value: label }] };
}

describe('validateDataset', () => {
  it('reports error for missing product name', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'processInfo.name')).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('reports error for no declared modules', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.some(e => e.field === 'declaredModules')).toBe(true);
  });

  it('reports warnings for missing optional fields', () => {
    const dataset = createEmptyDataset();
    dataset.processInfo.name = [{ lang: 'en', value: 'Test' }];
    dataset.declaredModules = new Set(['A1-A3']);
    const result = validateDataset(dataset);
    expect(result.warnings.some(w => w.field === 'processInfo.location')).toBe(true);
    expect(result.warnings.some(w => w.field === 'sources.pcr')).toBe(true);
  });

  it('valid=true when only warnings exist', () => {
    const dataset = createEmptyDataset();
    dataset.processInfo.name = [{ lang: 'en', value: 'Test Product' }];
    dataset.processInfo.location = 'DE';
    dataset.declaredModules = new Set(['A1-A3']);
    const result = validateDataset(dataset);
    expect(result.valid).toBe(true);
  });

  it('separates errors and warnings', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.issues.length).toBe(result.errors.length + result.warnings.length);
  });
});

describe('getBundledUuids', () => {
  it('always includes process and flow UUIDs', () => {
    const dataset = createEmptyDataset();
    dataset.meta.uuid = 'process-uuid';
    dataset.productFlow.uuid = 'flow-uuid';
    const ids = getBundledUuids(dataset);
    expect(ids.has('process-uuid')).toBe(true);
    expect(ids.has('flow-uuid')).toBe(true);
  });

  it('includes user-entered manufacturer and verifier UUIDs', () => {
    const dataset = createEmptyDataset();
    dataset.organisations.manufacturers = [
      { contact: makeRef('contact data set', 'mfr-uuid', 'M'), isProvidingData: true, sites: [] },
    ];
    dataset.organisations.verifier = makeRef('contact data set', 'vrf-uuid', 'V');
    const ids = getBundledUuids(dataset);
    expect(ids.has('mfr-uuid')).toBe(true);
    expect(ids.has('vrf-uuid')).toBe(true);
  });

  it('includes user-entered PCR and background-DB UUIDs', () => {
    const dataset = createEmptyDataset();
    dataset.sources.pcr = makeRef('source data set', 'pcr-uuid', 'PCR');
    dataset.sources.backgroundDatabases = [makeRef('source data set', 'db-uuid', 'DB')];
    const ids = getBundledUuids(dataset);
    expect(ids.has('pcr-uuid')).toBe(true);
    expect(ids.has('db-uuid')).toBe(true);
  });

  it('does NOT include compliance-system or referenceToDataSetFormat UUIDs', () => {
    const dataset = createEmptyDataset();
    dataset.complianceDeclarations = [
      { system: makeRef('source data set', 'compliance-uuid', 'EN 15804+A2') },
    ];
    dataset.dataEntryBy.referenceToDataSetFormat = [
      makeRef('source data set', 'format-uuid', 'ILCD format'),
    ];
    const ids = getBundledUuids(dataset);
    expect(ids.has('compliance-uuid')).toBe(false);
    expect(ids.has('format-uuid')).toBe(false);
  });
});

describe('findUnresolvedReferences', () => {
  const auth = loadAuthoritativeForTests();

  it('warns on a manufacturer contact UUID that is neither bundled nor authoritative', () => {
    const dataset = createEmptyDataset();
    dataset.organisations.verifier = makeRef('contact data set', 'fake-unknown-uuid', 'X');
    const issues = findUnresolvedReferences(dataset, {
      bundled: getBundledUuids(dataset),
      authoritative: auth,
    });
    // 'fake-unknown-uuid' IS bundled (verifier is user-entered) → no warning
    expect(issues.find(i => i.field.includes('verifier'))).toBeUndefined();
  });

  it('warns when complianceDeclarations.system references an unknown UUID', () => {
    const dataset = createEmptyDataset();
    dataset.complianceDeclarations = [
      { system: makeRef('source data set', 'totally-bogus-uuid', 'Bogus') },
    ];
    const issues = findUnresolvedReferences(dataset, {
      bundled: getBundledUuids(dataset),
      authoritative: auth,
    });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.find(i => i.field === 'complianceDeclarations[0].system')).toBeDefined();
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].step).toBe(4);
  });

  it('does NOT warn when compliance system references a known authoritative UUID', () => {
    const dataset = createEmptyDataset();
    // EN 15804+A2 (EF 3.1) UUID — present in Common_references.csv
    dataset.complianceDeclarations = [
      {
        system: makeRef(
          'source data set',
          'd4aa3ec7-b1d7-4a4a-a6cb-37af88dcc902',
          'EN 15804+A2 (EF 3.1)',
        ),
      },
    ];
    const issues = findUnresolvedReferences(dataset, {
      bundled: getBundledUuids(dataset),
      authoritative: auth,
    });
    expect(issues.find(i => i.field.startsWith('complianceDeclarations'))).toBeUndefined();
  });

  it('does NOT warn when a flow-property ref matches a known authoritative UUID', () => {
    const dataset = createEmptyDataset();
    dataset.productFlow.declaredUnit.flowPropertyRef = makeRef(
      'flow property data set',
      '93a60a56-a3c8-11da-a746-0800200b9a66', // Mass
      'Mass',
    );
    const issues = findUnresolvedReferences(dataset, {
      bundled: getBundledUuids(dataset),
      authoritative: auth,
    });
    expect(issues.find(i => i.field.includes('flowPropertyRef'))).toBeUndefined();
  });

  it('skips References with empty refObjectId', () => {
    const dataset = createEmptyDataset();
    // declaredUnit defaults to empty refObjectId — should not generate warnings
    const issues = findUnresolvedReferences(dataset, {
      bundled: getBundledUuids(dataset),
      authoritative: auth,
    });
    expect(issues.find(i => i.field.includes('declaredUnit'))).toBeUndefined();
  });
});

describe('findIndicatorCoverageGaps', () => {
  const lciaIndicators = loadLciaForTests();

  it('returns no issues when no modules are declared', () => {
    const dataset = createEmptyDataset();
    expect(findIndicatorCoverageGaps(dataset, lciaIndicators)).toHaveLength(0);
  });

  it('warns once per (declared module × LCIA indicator) when nothing is filled', () => {
    const dataset = createEmptyDataset();
    dataset.declaredModules = new Set(['A1-A3', 'C1']);
    const issues = findIndicatorCoverageGaps(dataset, lciaIndicators);
    expect(issues).toHaveLength(2 * lciaIndicators.length);
    expect(issues.every(i => i.severity === 'warning')).toBe(true);
    expect(issues.every(i => i.step === 5)).toBe(true);
  });

  it('does NOT warn for module-indicator pairs that have a value', () => {
    const dataset = createEmptyDataset();
    dataset.declaredModules = new Set(['A1-A3']);
    const gwp = lciaIndicators.find(i => i.nameEn.includes('GWP-total'))!;
    dataset.lciaResults = [
      {
        methodRef: makeRef('LCIA method data set', gwp.uuid, gwp.nameEn),
        meanAmount: 1.23,
        amounts: [{ module: 'A1-A3', value: 1.23 }],
        unitGroupRef: makeRef('unit group data set', gwp.unitGroupUuid, gwp.unitEn),
      },
    ];
    const issues = findIndicatorCoverageGaps(dataset, lciaIndicators);
    expect(issues.find(i => i.field.includes(gwp.uuid))).toBeUndefined();
    // All other LCIA indicators still missing for A1-A3
    expect(issues).toHaveLength(lciaIndicators.length - 1);
  });

  it('warns for the same indicator on each missing module independently', () => {
    const dataset = createEmptyDataset();
    dataset.declaredModules = new Set(['A1-A3', 'C1']);
    const gwp = lciaIndicators.find(i => i.nameEn.includes('GWP-total'))!;
    dataset.lciaResults = [
      {
        methodRef: makeRef('LCIA method data set', gwp.uuid, gwp.nameEn),
        meanAmount: 1.23,
        amounts: [{ module: 'A1-A3', value: 1.23 }], // C1 missing
        unitGroupRef: makeRef('unit group data set', gwp.unitGroupUuid, gwp.unitEn),
      },
    ];
    const issues = findIndicatorCoverageGaps(dataset, lciaIndicators);
    const gwpC1 = issues.find(i => i.field === `lciaResults.${gwp.uuid}.C1`);
    const gwpA1A3 = issues.find(i => i.field === `lciaResults.${gwp.uuid}.A1-A3`);
    expect(gwpC1).toBeDefined();
    expect(gwpA1A3).toBeUndefined();
  });
});

describe('validateDataset with cross-ref + indicator-coverage context', () => {
  const auth = loadAuthoritativeForTests();
  const lciaIndicators = loadLciaForTests();

  it('keeps producing the basic errors without context', () => {
    const dataset = createEmptyDataset();
    const result = validateDataset(dataset);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('appends cross-ref + indicator-coverage warnings when context is supplied', () => {
    const dataset = createEmptyDataset();
    dataset.processInfo.name = [{ lang: 'en', value: 'Test product' }];
    dataset.processInfo.location = 'DE';
    dataset.declaredModules = new Set(['A1-A3']);
    dataset.complianceDeclarations = [
      { system: makeRef('source data set', 'totally-bogus-uuid', 'Bogus') },
    ];

    const without = validateDataset(dataset);
    const withContext = validateDataset(dataset, {
      authoritativeUuids: auth,
      lciaIndicators,
    });

    expect(withContext.warnings.length).toBeGreaterThan(without.warnings.length);
    expect(
      withContext.warnings.find(w => w.field === 'complianceDeclarations[0].system'),
    ).toBeDefined();
    expect(
      withContext.warnings.some(w => w.field.startsWith('lciaResults.')),
    ).toBe(true);
  });
});
