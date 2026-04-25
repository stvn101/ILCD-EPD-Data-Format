import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import JSZip from 'jszip';
import { generateProcessXML } from '../xml/process-xml';
import { generateILCDZip } from '../zip-generator';
import { createEmptyDataset } from '../../model/epd-dataset';
import type { EPDDataset, LCIAResult } from '../../model/epd-dataset';
import { validateDataset } from '../../validation/validator';
import { buildAuthoritativeUuids } from '../../validation/authoritative-uuids';
import {
  parseIndicatorCSV,
  parseCommonReferencesCSV,
  parseFlowPropertiesCSV,
  parseBackgroundDbCSV,
  parseCountryIndicatorCSV,
} from '../../schema/indicator-parser';
import { NS } from '../../schema/namespaces';
import type { Reference } from '../../schema/types';

const IDENTIFIERS_DIR = resolve(
  __dirname,
  '../../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers',
);
function readCSV(name: string): string {
  return readFileSync(resolve(IDENTIFIERS_DIR, name), 'utf-8');
}

function ref(type: string, uuid: string, label: string, version?: string): Reference {
  return {
    type,
    refObjectId: uuid,
    version,
    shortDescription: [{ lang: 'en', value: label }],
  };
}

function parseXML(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error(`XML parse error: ${parseError.textContent}`);
  return doc;
}

function buildFullyPopulatedDataset(): EPDDataset {
  const d = createEmptyDataset('+A2/EF3.1');

  d.meta.uuid = 'smoke-test-process-uuid';
  d.meta.dataSetVersion = '00.01.000';

  // processInfo
  d.processInfo.name = [
    { lang: 'en', value: 'Smoke Test Wood Panel' },
    { lang: 'de', value: 'Rauchprüfung Holzpanel' },
  ];
  d.processInfo.location = 'DE';
  d.processInfo.locationDescription = [{ lang: 'en', value: 'Germany' }];
  d.processInfo.referenceYear = 2025;
  d.processInfo.validUntil = 2030;
  d.processInfo.technologyDescription = [{ lang: 'en', value: 'Standard panel manufacturing.' }];
  d.processInfo.technologicalApplicability = [{ lang: 'en', value: 'Construction.' }];
  d.processInfo.generalComment = [{ lang: 'en', value: 'Synthetic dataset for smoke testing.' }];
  d.processInfo.expirationDateOfEPD = '2030-12-31';
  d.processInfo.publicationDateOfEPD = '2025-01-15';

  d.processInfo.classification = {
    classesFile: 'ILCDClassification',
    entries: [
      { level: 0, value: 'Construction products' },
      { level: 1, value: 'Wood' },
    ],
  };

  d.processInfo.productIds = [{ type: 'GTIN', value: '4012345678901' }];

  d.processInfo.serviceLife = {
    years: 50,
    useConditionFactors: [
      {
        factorCategory: 'A - inherent quality',
        objectSpecificGrade: 4,
        referenceGrade: 3,
        factor: 1.33,
        comments: [{ lang: 'en', value: 'Typical commercial-grade installation.' }],
      },
    ],
    standardRef: ref('source data set', 'iso-15686-7-uuid', 'ISO 15686-7'),
    useConditionsDocumentationRef: ref('source data set', 'use-conditions-doc-uuid', 'Use Conditions'),
    comments: [{ lang: 'en', value: 'Reference service life under typical use.' }],
  };

  d.processInfo.scenarioData = {
    useStageScenarioData: {
      soilAndWaterImpactsDescription: [{ lang: 'en', value: 'No significant impacts.' }],
    },
    eolScenarioData: [
      {
        scenario: 'Recycling',
        collection: { separate: 0.9, withMixedWaste: 0.1 },
        recovery: { recycling: 0.85, energyRecovery: 0.05 },
        disposal: { finalDeposition: 0.1 },
      },
    ],
  };

  d.processInfo.svhc = { present: false };

  d.processInfo.variability = {
    manufacturerVariability: { type: 'production sites', variation: 5, variationRange: '±5%' },
    productVariability: { type: 'product variation', variation: 3 },
    description: [{ lang: 'en', value: 'Low variability across sites.' }],
  };

  d.processInfo.pcrCompliance = {
    allocation: true,
    cutOffRules: true,
    upstreamDataDeviatingFromAllocationPrinciples: false,
  };

  // productFlow — Mass (kg)
  d.productFlow.uuid = 'smoke-test-flow-uuid';
  d.productFlow.name = [{ lang: 'en', value: 'Wood panel, 18mm' }];
  d.productFlow.declaredUnit = {
    flowPropertyRef: ref(
      'flow property data set',
      '93a60a56-a3c8-11da-a746-0800200b9a66',
      'Mass',
      '03.00.000',
    ),
    unitGroupRef: ref(
      'unit group data set',
      '93a60a57-a4c8-11da-a746-0800200c9a66',
      'Units of mass',
    ),
  };
  d.productFlow.materialProperties = [
    { propertyName: 'gross density', value: 650, materialName: 'wood panel' },
    { propertyName: 'grammage', value: 11.7, materialName: 'wood panel' },
  ];

  // declaredModules — full life cycle
  d.declaredModules = new Set(['A1-A3', 'C1', 'C2', 'C3', 'C4', 'D']);

  // lciaResults — synthesise a result for every LCIA indicator × every declared module
  const lciaIndicators = parseIndicatorCSV(
    readCSV('EN15804+A2_EF3.1_indicators.csv'),
    '+A2/EF3.1',
  ).lcia;
  const declaredModulesArr = Array.from(d.declaredModules);
  d.lciaResults = lciaIndicators.map((ind) => {
    const result: LCIAResult = {
      methodRef: ref('LCIA method data set', ind.uuid, ind.nameEn, ind.version),
      meanAmount: 1,
      amounts: declaredModulesArr.map((m) => ({ module: m, value: 1 })),
      unitGroupRef: ref('unit group data set', ind.unitGroupUuid, ind.unitEn),
    };
    return result;
  });

  // organisations
  d.organisations.manufacturers = [
    {
      contact: ref('contact data set', 'mfr-uuid-1', 'Wood Products GmbH'),
      isProvidingData: true,
      sites: [
        {
          name: 'Hamburg plant',
          facilityIdentifier: 'HAM-001',
          olc: '8FX9HCQ4+QH',
          geoCode: 'DE-HH',
          streetAddress: 'Hafenweg 1, 20457 Hamburg',
        },
      ],
    },
  ];
  d.organisations.dataGenerator = ref('contact data set', 'data-gen-uuid', 'LCA Studio');
  d.organisations.programmeOperator = ref(
    'contact data set',
    'prog-op-uuid',
    'IBU Programme',
  );
  d.organisations.verifier = ref('contact data set', 'verifier-uuid', 'Independent Verifier GmbH');
  d.organisations.ownerOfDataSet = ref('contact data set', 'owner-uuid', 'Wood Products GmbH');

  // compliance — EN 15804+A2 (EF 3.1) is in Common_references.csv
  d.complianceDeclarations = [
    {
      system: ref(
        'source data set',
        'd4aa3ec7-b1d7-4a4a-a6cb-37af88dcc902',
        'EN 15804+A2 (EF 3.1)',
      ),
      overallCompliance: 'Fully compliant',
    },
  ];

  // dataEntryBy — ILCD format
  d.dataEntryBy.referenceToDataSetFormat = [
    ref('source data set', 'a97a0155-0234-4b87-b4ce-a45da52f2a40', 'ILCD format'),
  ];

  // publicationAndOwnership
  d.publicationAndOwnership.dateOfLastRevision = '2025-01-15T00:00:00Z';
  d.publicationAndOwnership.registrationNumber = 'EPD-WOOD-2025-001';
  d.publicationAndOwnership.referenceToOwner = ref(
    'contact data set',
    'owner-uuid',
    'Wood Products GmbH',
  );
  d.publicationAndOwnership.referenceToPublisher = ref(
    'contact data set',
    'publisher-uuid',
    'IBU Publisher',
  );
  d.publicationAndOwnership.registrationAuthority = ref(
    'contact data set',
    'reg-authority-uuid',
    'IBU Registration',
  );

  // sources
  d.sources.pcr = ref('source data set', 'pcr-uuid', 'PCR Construction Products 2020');
  d.sources.backgroundDatabases = [
    ref(
      'source data set',
      '28d74cc0-db8b-4d7e-bc44-5f6d56ce0c4a',
      'GaBi Database (general)',
    ),
  ];
  d.sources.epdDocument = ref('source data set', 'epd-doc-uuid', 'Smoke Test EPD report');

  return d;
}

function loadFullAuthoritativeSet(): Set<string> {
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

describe('end-to-end smoke test (+A2/EF3.1, fully populated)', () => {
  const dataset = buildFullyPopulatedDataset();

  it('produces parseable process.xml with all v1.3 namespaces and key blocks', () => {
    const xml = generateProcessXML(dataset);
    const doc = parseXML(xml);
    expect(doc.documentElement.localName).toBe('processDataSet');

    // All three EPD namespaces present
    expect(xml).toContain(`xmlns:epd="${NS.EPD_2013}"`);
    expect(xml).toContain(`xmlns:epd2="${NS.EPD_2019}"`);
    expect(xml).toContain(`xmlns:epd24="${NS.EPD_2024}"`);
    expect(xml).toContain('epd2:epd-version="1.3"');

    // All major v1.3 epd24: blocks present
    expect(xml).toContain('<epd24:productIds>');
    expect(xml).toContain('<epd24:referenceServiceLife');
    expect(xml).toContain('<epd24:scenarioData>');
    expect(xml).toContain('<epd24:eolScenarioData');
    expect(xml).toContain('<epd24:manufacturers>');
    expect(xml).toContain('<epd24:site>');
    expect(xml).toContain('<epd24:pcrCompliance');
    expect(xml).toContain('<epd24:SVHC');
    expect(xml).toContain('<epd24:variability>');
    expect(xml).toContain('<epd24:expirationDateOfEPD>');
  });

  it('produces a ZIP with the expected folder structure', async () => {
    const blob = await generateILCDZip(dataset);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const files = Object.keys(zip.files).filter((p) => p.endsWith('.xml'));

    // Process and flow files
    expect(files).toContain('ILCD/processes/smoke-test-process-uuid.xml');
    expect(files).toContain('ILCD/flows/smoke-test-flow-uuid.xml');

    // Contacts: manufacturer, dataGenerator, programmeOperator, verifier, owner,
    // publisher, registrationAuthority — 7 unique (ownerOfDataSet shares 'owner-uuid'
    // with publicationAndOwnership.referenceToOwner so dedupes to one file).
    const contacts = files.filter((p) => p.startsWith('ILCD/contacts/'));
    expect(contacts).toContain('ILCD/contacts/mfr-uuid-1.xml');
    expect(contacts).toContain('ILCD/contacts/data-gen-uuid.xml');
    expect(contacts).toContain('ILCD/contacts/prog-op-uuid.xml');
    expect(contacts).toContain('ILCD/contacts/verifier-uuid.xml');
    expect(contacts).toContain('ILCD/contacts/owner-uuid.xml');
    expect(contacts).toContain('ILCD/contacts/publisher-uuid.xml');
    expect(contacts).toContain('ILCD/contacts/reg-authority-uuid.xml');
    expect(contacts).toHaveLength(7);

    // Sources: PCR, GaBi (background DB), EPD doc, ISO 15686-7 (serviceLife.standardRef),
    // use-conditions doc — 5 unique.
    const sources = files.filter((p) => p.startsWith('ILCD/sources/'));
    expect(sources).toContain('ILCD/sources/pcr-uuid.xml');
    expect(sources).toContain('ILCD/sources/28d74cc0-db8b-4d7e-bc44-5f6d56ce0c4a.xml');
    expect(sources).toContain('ILCD/sources/epd-doc-uuid.xml');
    expect(sources).toContain('ILCD/sources/iso-15686-7-uuid.xml');
    expect(sources).toContain('ILCD/sources/use-conditions-doc-uuid.xml');
    expect(sources).toHaveLength(5);
  });

  it('every refObjectId in process.xml resolves to a bundled file or authoritative UUID', async () => {
    const blob = await generateILCDZip(dataset);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    const bundledUuids = new Set<string>();
    for (const path of Object.keys(zip.files)) {
      const m = path.match(/\/([\w-]+)\.xml$/);
      if (m) bundledUuids.add(m[1]);
    }

    const authoritative = loadFullAuthoritativeSet();
    const xml = await zip.file('ILCD/processes/smoke-test-process-uuid.xml')!.async('text');

    // Pull every refObjectId attribute from the process XML
    const refIds = new Set<string>();
    const re = /refObjectId="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(xml)) !== null) refIds.add(match[1]);

    expect(refIds.size).toBeGreaterThan(0);

    const unresolved: string[] = [];
    for (const id of refIds) {
      if (bundledUuids.has(id)) continue;
      if (authoritative.has(id)) continue;
      unresolved.push(id);
    }
    expect(unresolved).toEqual([]);
  });

  it('passes validation with no errors and no unresolved-reference warnings', () => {
    const result = validateDataset(dataset, {
      authoritativeUuids: loadFullAuthoritativeSet(),
      lciaIndicators: parseIndicatorCSV(
        readCSV('EN15804+A2_EF3.1_indicators.csv'),
        '+A2/EF3.1',
      ).lcia,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    const unresolvedRefs = result.warnings.filter((w) =>
      w.message.startsWith('Referenced UUID'),
    );
    expect(unresolvedRefs).toEqual([]);

    const indicatorGaps = result.warnings.filter((w) => w.field.startsWith('lciaResults.'));
    expect(indicatorGaps).toEqual([]);
  });
});
