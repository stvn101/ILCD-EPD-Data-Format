import { describe, it, expect, beforeEach } from 'vitest';
import { generateProcessXML } from '../xml/process-xml';
import { createEmptyDataset } from '../../model/epd-dataset';
import type { EPDDataset } from '../../model/epd-dataset';
import { NS } from '../../schema/namespaces';

// Helper: parse returned XML to a DOM document
function parseXML(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error: ${parseError.textContent}`);
  }
  return doc;
}

// Helper: get text of first matching element (XPath-like via getElementsByTagNameNS)
function getText(doc: Document, ns: string, localName: string): string | null {
  const els = doc.getElementsByTagNameNS(ns, localName);
  return els.length > 0 ? els[0].textContent : null;
}

describe('generateProcessXML', () => {
  let dataset: EPDDataset;

  beforeEach(() => {
    dataset = createEmptyDataset('+A2/EF3.1');
    dataset.meta.uuid = 'test-uuid-1234-5678';
    dataset.processInfo.name = [
      { lang: 'en', value: 'Test Product' },
      { lang: 'de', value: 'Testprodukt' },
    ];
  });

  // ---- Test 1: Valid XML with correct root element and namespaces for +A2/EF3.1 ----
  it('generates valid XML with correct root element and all namespaces for +A2/EF3.1', () => {
    const xml = generateProcessXML(dataset);

    // Should be parseable
    const doc = parseXML(xml);
    expect(doc).toBeDefined();

    // Root element should be processDataSet
    expect(doc.documentElement.localName).toBe('processDataSet');

    // Check declared namespaces via string matching (DOMParser in jsdom handles ns attrs)
    expect(xml).toContain(`xmlns="${NS.PROCESS}"`);
    expect(xml).toContain(`xmlns:common="${NS.COMMON}"`);
    expect(xml).toContain(`xmlns:xsi="${NS.XSI}"`);
    expect(xml).toContain(`xmlns:epd="${NS.EPD_2013}"`);
    expect(xml).toContain(`xmlns:epd2="${NS.EPD_2019}"`);
    expect(xml).toContain(`xmlns:epd24="${NS.EPD_2024}"`);

    // epd2:epd-version="1.3" should be present when epd2 namespace is present
    expect(xml).toContain('epd2:epd-version="1.3"');
  });

  // ---- Test 2: UUID and baseName elements ----
  it('includes UUID and baseName elements', () => {
    const xml = generateProcessXML(dataset);
    const doc = parseXML(xml);

    const uuid = getText(doc, NS.COMMON, 'UUID');
    expect(uuid).toBe('test-uuid-1234-5678');

    const baseNames = doc.getElementsByTagNameNS(NS.PROCESS, 'baseName');
    expect(baseNames.length).toBeGreaterThanOrEqual(2);

    const enName = Array.from(baseNames).find(
      el => el.getAttribute('xml:lang') === 'en',
    );
    expect(enName?.textContent).toBe('Test Product');

    const deName = Array.from(baseNames).find(
      el => el.getAttribute('xml:lang') === 'de',
    );
    expect(deName?.textContent).toBe('Testprodukt');
  });

  // ---- Test 3: typeOfDataSet is always "EPD" ----
  it('always sets typeOfDataSet to "EPD"', () => {
    const xml = generateProcessXML(dataset);
    expect(xml).toContain('<typeOfDataSet>EPD</typeOfDataSet>');

    // Also verify for +A1
    const a1Dataset = createEmptyDataset('+A1');
    const a1Xml = generateProcessXML(a1Dataset);
    expect(a1Xml).toContain('<typeOfDataSet>EPD</typeOfDataSet>');
  });

  // ---- Test 4: subType is rendered correctly ----
  it('renders subType correctly inside epd:subType', () => {
    dataset.meta.subType = 'average dataset';
    const xml = generateProcessXML(dataset);
    expect(xml).toContain('<epd:subType>average dataset</epd:subType>');
  });

  it('renders different subType values correctly', () => {
    dataset.meta.subType = 'generic dataset';
    const xml = generateProcessXML(dataset);
    expect(xml).toContain('<epd:subType>generic dataset</epd:subType>');
  });

  // ---- Test 5: Omits epd24 and epd2 namespaces for +A1 datasets ----
  it('omits epd24 and epd2 namespaces for +A1 datasets', () => {
    const a1Dataset = createEmptyDataset('+A1');
    const xml = generateProcessXML(a1Dataset);

    expect(xml).toContain(`xmlns:epd="${NS.EPD_2013}"`);
    expect(xml).not.toContain(`xmlns:epd2="`);
    expect(xml).not.toContain(`xmlns:epd24="`);
    expect(xml).not.toContain('epd2:epd-version');
  });

  it('includes epd and epd2 but not epd24 namespaces for +A2/EF3.0 datasets', () => {
    const ef30Dataset = createEmptyDataset('+A2/EF3.0');
    const xml = generateProcessXML(ef30Dataset);

    expect(xml).toContain(`xmlns:epd="${NS.EPD_2013}"`);
    expect(xml).toContain(`xmlns:epd2="${NS.EPD_2019}"`);
    expect(xml).not.toContain(`xmlns:epd24="`);
    expect(xml).toContain('epd2:epd-version="1.3"');
  });

  // ---- Task 1: SVHC tag uses uppercase, lives in epd24 namespace ----
  it('emits SVHC with uppercase tag in epd24 namespace for +A2/EF3.1', () => {
    dataset.processInfo.svhc = { present: true };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:SVHC epd24:present="true"/>');
    expect(xml).not.toContain('<epd24:svhc');
  });

  it('omits SVHC for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.svhc = { present: true };
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('SVHC');
    expect(xml).not.toContain('epd24:svhc');
  });

  // ---- Task 1: Variability lives in epd24 namespace per v1.3 migration guide ----
  it('emits variability in epd24 namespace with all child fields for +A2/EF3.1', () => {
    dataset.processInfo.variability = {
      manufacturerVariability: {
        type: 'Single production site',
        variation: 5,
        variationRange: 'B - between 2,5% and 10%',
      },
      productVariability: {
        type: 'Range of products where variability is described',
        variation: 20,
        variationRange: 'C - between 10% and 25%',
      },
      description: [
        { lang: 'en', value: 'Sensitivity analysis performed.' },
        { lang: 'de', value: 'Sensitivitätsanalyse durchgeführt.' },
      ],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:variability>');
    expect(xml).toContain('epd24:manufacturerVariability');
    expect(xml).toContain('epd24:type="Single production site"');
    expect(xml).toContain('epd24:variation="5"');
    expect(xml).toContain('epd24:variationRange="B - between 2,5% and 10%"');
    expect(xml).toContain('epd24:productVariability');
    expect(xml).toContain('epd24:variabilityDescription xml:lang="en"');
    expect(xml).toContain('Sensitivity analysis performed.');

    // Old (incorrect) namespace must not leak through
    expect(xml).not.toContain('<epd2:variability>');
    expect(xml).not.toContain('epd2:manufacturerVariability');
  });

  it('omits variability for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.variability = {
      manufacturerVariability: { type: 'X', variation: 1 },
      productVariability: { type: 'Y', variation: 2 },
      description: [],
    };
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('variability>');
    expect(xml).not.toContain('manufacturerVariability');
  });

  // ---- Task 2: epd2:contentDeclaration ----
  it('emits contentDeclaration with materials and substances for +A2/EF3.1', () => {
    dataset.processInfo.contentDeclaration = {
      components: [],
      materials: [
        {
          name: [{ lang: 'en', value: 'pine wood' }],
          weightPerc: { value: 98.0 },
          mass: {},
          packaging: false,
          renewable: 100.0,
          substances: [],
        },
        {
          name: [{ lang: 'en', value: 'cardboard' }],
          weightPerc: { value: 3.0 },
          mass: {},
          packaging: true,
          recyclable: 100.0,
          recycled: 100.0,
          substances: [],
        },
      ],
      substances: [
        {
          name: 'Sodium perfluoroheptanoate',
          weightPerc: { value: 0.042 },
          CASNumber: '20109-59-5',
          ECNumber: '243-518-4',
          hazardCode: 'SVHC;H360D;H372',
        },
      ],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd2:contentDeclaration>');
    // Material 1 with renewable
    expect(xml).toContain('<epd2:material epd2:packaging="false" epd2:renewable="100"');
    expect(xml).toContain('<epd2:name xml:lang="en">pine wood</epd2:name>');
    expect(xml).toContain('<epd2:weightPerc epd2:value="98"/>');
    // Material 2 with packaging + recyclable + recycled
    expect(xml).toContain('epd2:packaging="true"');
    expect(xml).toContain('epd2:recyclable="100"');
    expect(xml).toContain('epd2:recycled="100"');
    // Empty mass element required by XSD
    expect(xml).toContain('<epd2:mass/>');
    // Substance attributes
    expect(xml).toContain('<epd2:substance');
    expect(xml).toContain('epd2:CASNumber="20109-59-5"');
    expect(xml).toContain('epd2:ECNumber="243-518-4"');
    expect(xml).toContain('epd2:hazardCode="SVHC;H360D;H372"');
    expect(xml).toContain('<epd2:name>Sodium perfluoroheptanoate</epd2:name>');
    expect(xml).toContain('<epd2:weightPerc epd2:value="0.042"/>');
    expect(xml).toContain('</epd2:contentDeclaration>');
  });

  it('emits contentDeclaration components with nested materials', () => {
    dataset.processInfo.contentDeclaration = {
      components: [
        {
          name: 'Frame assembly',
          weightPerc: { value: 80.0 },
          materials: [
            {
              name: [{ lang: 'en', value: 'aluminium' }],
              weightPerc: { value: 95.0 },
              mass: { value: 12.5 },
              substances: [],
            },
          ],
        },
      ],
      materials: [],
      substances: [],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd2:component>');
    expect(xml).toContain('<epd2:name>Frame assembly</epd2:name>');
    expect(xml).toContain('<epd2:material>');
    expect(xml).toContain('<epd2:name xml:lang="en">aluminium</epd2:name>');
    expect(xml).toContain('<epd2:mass epd2:value="12.5"/>');
    expect(xml).toContain('</epd2:component>');
  });

  it('emits contentDeclaration with weightPerc range values', () => {
    dataset.processInfo.contentDeclaration = {
      components: [],
      materials: [
        {
          name: [{ lang: 'en', value: 'mixed wood' }],
          weightPerc: { lowerValue: 90.0, upperValue: 99.0 },
          mass: {},
          substances: [],
        },
      ],
      substances: [],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd2:weightPerc epd2:lowerValue="90" epd2:upperValue="99"/>');
  });

  it('omits contentDeclaration for +A1 datasets', () => {
    const a1 = createEmptyDataset('+A1');
    a1.processInfo.contentDeclaration = {
      components: [],
      materials: [
        {
          name: [{ lang: 'en', value: 'wood' }],
          weightPerc: { value: 100 },
          mass: {},
          substances: [],
        },
      ],
      substances: [],
    };
    const xml = generateProcessXML(a1);

    expect(xml).not.toContain('contentDeclaration');
    expect(xml).not.toContain('<epd2:material');
  });

  it('emits contentDeclaration for +A2/EF3.0 datasets', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.contentDeclaration = {
      components: [],
      materials: [
        {
          name: [{ lang: 'en', value: 'glass' }],
          weightPerc: { value: 100 },
          mass: {},
          substances: [],
        },
      ],
      substances: [],
    };
    const xml = generateProcessXML(ef30);

    expect(xml).toContain('<epd2:contentDeclaration>');
    expect(xml).toContain('<epd2:material>');
  });

  it('omits contentDeclaration when the field is undefined', () => {
    // dataset is +A2/EF3.1 by default and has no contentDeclaration assigned
    const xml = generateProcessXML(dataset);
    expect(xml).not.toContain('contentDeclaration');
  });

  // ---- Task 4: productIds ----
  it('emits productIds with type and value attributes for +A2/EF3.1', () => {
    dataset.processInfo.productIds = [
      { type: 'GTIN', value: '3234567890126' },
      { type: 'GTIN', value: '3234567890132' },
      { type: 'GMN', value: '445922' },
    ];
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:productIds>');
    expect(xml).toContain('<epd24:productId epd24:type="GTIN">3234567890126</epd24:productId>');
    expect(xml).toContain('<epd24:productId epd24:type="GTIN">3234567890132</epd24:productId>');
    expect(xml).toContain('<epd24:productId epd24:type="GMN">445922</epd24:productId>');
    expect(xml).toContain('</epd24:productIds>');
  });

  it('omits productIds for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.productIds = [{ type: 'GTIN', value: '12345' }];
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('productIds');
    expect(xml).not.toContain('productId');
  });

  // ---- Task 4: referenceServiceLife / estimatedServiceLife ----
  it('emits referenceServiceLife with use-condition factors and references', () => {
    dataset.processInfo.serviceLife = {
      years: 100,
      useConditionFactors: [
        { factorCategory: 'A - inherent quality', objectSpecificGrade: 1, referenceGrade: 1, factor: 1 },
        {
          factorCategory: 'E - outdoor environment',
          objectSpecificGrade: 2,
          referenceGrade: 1,
          factor: 0.9,
          comments: [
            { lang: 'en', value: 'Lots of rain but no wind' },
            { lang: 'de', value: 'Viel Regen, kein Wind' },
          ],
        },
      ],
      standardRef: {
        type: 'source data set',
        refObjectId: 'std-uuid-1',
        version: '00.01.000',
        shortDescription: [{ lang: 'en', value: 'EN15804+A2' }],
      },
      useConditionsDocumentationRef: {
        type: 'source data set',
        refObjectId: 'doc-uuid-1',
        shortDescription: [{ lang: 'en', value: 'wood panel use conditions' }],
      },
      comments: [
        { lang: 'en', value: 'Requires installation per manufacturer instructions.' },
      ],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:referenceServiceLife epd24:years="100">');
    expect(xml).toContain(
      '<epd24:useConditionFactor epd24:factorCategory="A - inherent quality" epd24:objectSpecificGrade="1" epd24:referenceGrade="1" epd24:factor="1"/>',
    );
    // Factor with comments uses the open/close form
    expect(xml).toContain(
      '<epd24:useConditionFactor epd24:factorCategory="E - outdoor environment" epd24:objectSpecificGrade="2" epd24:referenceGrade="1" epd24:factor="0.9">',
    );
    expect(xml).toContain('Lots of rain but no wind');
    expect(xml).toContain('Viel Regen, kein Wind');
    // References
    expect(xml).toContain('<epd24:referenceToStandard');
    expect(xml).toContain('refObjectId="std-uuid-1"');
    expect(xml).toContain('<epd24:referenceToUseConditionsDocumentation');
    expect(xml).toContain('refObjectId="doc-uuid-1"');
    // Comments
    expect(xml).toContain('<epd24:comment xml:lang="en">Requires installation per manufacturer instructions.</epd24:comment>');
    expect(xml).toContain('</epd24:referenceServiceLife>');
  });

  it('emits estimatedServiceLife alongside referenceServiceLife when both are set', () => {
    dataset.processInfo.serviceLife = {
      years: 100,
      useConditionFactors: [],
      comments: [],
    };
    dataset.processInfo.estimatedServiceLife = {
      years: 8,
      useConditionFactors: [
        { factorCategory: 'A - inherent quality', objectSpecificGrade: 5, referenceGrade: 1, factor: 0.7 },
      ],
      comments: [],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:referenceServiceLife epd24:years="100">');
    expect(xml).toContain('<epd24:estimatedServiceLife epd24:years="8">');
    expect(xml).toContain('epd24:objectSpecificGrade="5"');
  });

  it('omits service life for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.serviceLife = {
      years: 50,
      useConditionFactors: [],
      comments: [],
    };
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('referenceServiceLife');
    expect(xml).not.toContain('estimatedServiceLife');
  });

  // ---- Task 4: scenarioData ----
  it('emits scenarioData with useStage and EoL blocks', () => {
    dataset.processInfo.scenarioData = {
      useStageScenarioData: {
        soilAndWaterImpactsDescription: [
          { lang: 'en', value: 'Potential release of adhesives.' },
          { lang: 'de', value: 'Mögliche Freisetzung von Klebstoffen.' },
        ],
      },
      eolScenarioData: [
        {
          scenario: '100% recycling',
          collection: { separate: 0.9, withMixedWaste: 0.1 },
          recovery: { reuse: 0, recycling: 0.9, energyRecovery: 0 },
          disposal: { finalDeposition: 0.1 },
        },
        {
          scenario: '100% incineration',
          collection: { separate: 0.9, withMixedWaste: 0.1 },
          recovery: { reuse: 0, recycling: 0, energyRecovery: 0.9 },
          disposal: { finalDeposition: 0.1 },
        },
      ],
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:scenarioData>');
    expect(xml).toContain('<epd24:useStageScenarioData>');
    expect(xml).toContain('<epd24:soilAndWaterImpacts>');
    expect(xml).toContain('Potential release of adhesives.');
    // EoL scenarios
    expect(xml).toContain('<epd24:eolScenarioData epd24:scenario="100% recycling">');
    expect(xml).toContain('<epd24:collection epd24:separate="0.9" epd24:withMixedWaste="0.1"/>');
    expect(xml).toContain('<epd24:recovery epd24:reuse="0" epd24:recycling="0.9" epd24:energyRecovery="0"/>');
    expect(xml).toContain('<epd24:disposal epd24:finalDeposition="0.1"/>');
    expect(xml).toContain('<epd24:eolScenarioData epd24:scenario="100% incineration">');
    expect(xml).toContain('</epd24:scenarioData>');
  });

  it('omits scenarioData for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.scenarioData = {
      eolScenarioData: [{ scenario: 'X', recovery: { recycling: 1 } }],
    };
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('scenarioData');
    expect(xml).not.toContain('eolScenarioData');
  });

  // ---- Task 4: expirationDateOfEPD moved to epd24 ns ----
  it('emits expirationDateOfEPD in the epd24 namespace, inside time/common:other', () => {
    dataset.processInfo.expirationDateOfEPD = '2024-05-08';
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:expirationDateOfEPD>2024-05-08</epd24:expirationDateOfEPD>');
    // Old (incorrect) namespace must be gone
    expect(xml).not.toContain('<epd2:expirationDateOfEPD');
  });

  it('omits expirationDateOfEPD for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.expirationDateOfEPD = '2024-05-08';
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('expirationDateOfEPD');
  });

  // ---- Task 4: manufacturers with sites ----
  it('emits manufacturer with isProvidingData attr, contact reference, and sites', () => {
    dataset.organisations.manufacturers = [
      {
        contact: {
          type: 'contact data set',
          refObjectId: 'mfr-contact-uuid',
          version: '00.00.000',
          shortDescription: [{ lang: 'en', value: 'ACME' }],
        },
        isProvidingData: true,
        sites: [
          {
            name: 'ACME Base camp',
            facilityIdentifier: 'KELLNERDOM',
            olc: '9F28WXR4+FW2',
            geoCode: 'DE',
            streetAddress: 'Domkloster 4, 50667 Cologne, Germany',
          },
        ],
      },
    ];
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:manufacturers>');
    expect(xml).toContain('<epd24:manufacturer epd24:isProvidingData="true">');
    // Contact uses the correct element name (epd24:contact, not epd24:referenceToManufacturer)
    expect(xml).toContain('<epd24:contact');
    expect(xml).toContain('refObjectId="mfr-contact-uuid"');
    expect(xml).not.toContain('epd24:referenceToManufacturer');
    // Sites
    expect(xml).toContain('<epd24:sites>');
    expect(xml).toContain('<epd24:site>');
    expect(xml).toContain('<epd24:name>ACME Base camp</epd24:name>');
    expect(xml).toContain('<epd24:facilityIdentifier>KELLNERDOM</epd24:facilityIdentifier>');
    expect(xml).toContain('<epd24:olc>9F28WXR4+FW2</epd24:olc>');
    expect(xml).toContain('<epd24:geoCode>DE</epd24:geoCode>');
    expect(xml).toContain(
      '<epd24:streetAddress>Domkloster 4, 50667 Cologne, Germany</epd24:streetAddress>',
    );
    expect(xml).toContain('</epd24:site>');
    expect(xml).toContain('</epd24:manufacturers>');
  });

  it('emits manufacturer without sites block when no sites are present', () => {
    dataset.organisations.manufacturers = [
      {
        contact: {
          type: 'contact data set',
          refObjectId: 'm-uuid',
          shortDescription: [{ lang: 'en', value: 'X' }],
        },
        isProvidingData: false,
        sites: [],
      },
    ];
    const xml = generateProcessXML(dataset);

    expect(xml).toContain('<epd24:manufacturer epd24:isProvidingData="false">');
    expect(xml).toContain('<epd24:contact');
    expect(xml).not.toContain('<epd24:sites>');
  });

  it('omits manufacturers for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.organisations.manufacturers = [
      {
        contact: { type: 'contact data set', refObjectId: 'm', shortDescription: [] },
        isProvidingData: true,
        sites: [{ name: 'site1' }],
      },
    ];
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('epd24:manufacturers');
    expect(xml).not.toContain('epd24:manufacturer');
  });

  // ---- Task 4: pcrCompliance ----
  it('emits pcrCompliance as a self-closing element with three boolean attrs', () => {
    dataset.processInfo.pcrCompliance = {
      allocation: true,
      cutOffRules: true,
      upstreamDataDeviatingFromAllocationPrinciples: false,
    };
    const xml = generateProcessXML(dataset);

    expect(xml).toContain(
      '<epd24:pcrCompliance epd24:allocation="true" epd24:cutOffRules="true" epd24:upstreamDataDeviatingFromAllocationPrinciples="false"/>',
    );
  });

  it('omits pcrCompliance for standards without epd24 namespace', () => {
    const ef30 = createEmptyDataset('+A2/EF3.0');
    ef30.processInfo.pcrCompliance = {
      allocation: true,
      cutOffRules: true,
      upstreamDataDeviatingFromAllocationPrinciples: false,
    };
    const xml = generateProcessXML(ef30);

    expect(xml).not.toContain('pcrCompliance');
  });

  // ---- Task 4: subType + variability + pcrCompliance share one common:other ----
  it('LCIMethodAndAllocation has a single common:other holding subType, variability, and pcrCompliance', () => {
    dataset.processInfo.variability = {
      manufacturerVariability: { type: 'X', variation: 5 },
      productVariability: { type: 'Y', variation: 20 },
      description: [],
    };
    dataset.processInfo.pcrCompliance = {
      allocation: true,
      cutOffRules: true,
      upstreamDataDeviatingFromAllocationPrinciples: false,
    };
    const xml = generateProcessXML(dataset);

    // Extract the LCIMethodAndAllocation block and assert it contains exactly one <common:other>
    const start = xml.indexOf('<LCIMethodAndAllocation>');
    const end = xml.indexOf('</LCIMethodAndAllocation>');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const block = xml.slice(start, end);
    const otherCount = (block.match(/<common:other>/g) || []).length;
    expect(otherCount).toBe(1);
    // And that common:other contains all three pieces
    expect(block).toContain('<epd:subType>');
    expect(block).toContain('<epd24:variability>');
    expect(block).toContain('<epd24:pcrCompliance');
  });

  // ---- Test 6: Exchanges with epd:amount per module and scenario ----
  it('generates exchanges with epd:amount per module and scenario', () => {
    dataset.exchanges = [
      {
        dataSetInternalID: 1,
        flowRef: {
          type: 'flow data set',
          refObjectId: 'flow-uuid-001',
          version: '00.01.000',
          shortDescription: [{ lang: 'en', value: 'Electricity' }],
        },
        exchangeDirection: 'Input',
        meanAmount: 100,
        amounts: [
          { module: 'A1', value: 10 },
          { module: 'A2', value: 20 },
          { module: 'A1-A3', scenario: 'ScenA', value: 30 },
        ],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: 'unit-uuid-001',
          shortDescription: [],
        },
      },
    ];

    const xml = generateProcessXML(dataset);

    // Exchange container element
    expect(xml).toContain('dataSetInternalID="1"');

    // Function type
    expect(xml).toContain('<functionType>General reminder flow</functionType>');

    // Direction
    expect(xml).toContain('<exchangeDirection>Input</exchangeDirection>');

    // Mean amount
    expect(xml).toContain('<meanAmount>100</meanAmount>');

    // Module amounts without scenario
    expect(xml).toContain('epd:module="A1"');
    expect(xml).toContain('epd:module="A2"');

    // Module amount with scenario
    expect(xml).toContain('epd:module="A1-A3" epd:scenario="ScenA"');

    // Values
    expect(xml).toContain('>10<');
    expect(xml).toContain('>20<');
    expect(xml).toContain('>30<');
  });

  it('wraps exchange amounts in common:other', () => {
    dataset.exchanges = [
      {
        dataSetInternalID: 2,
        flowRef: {
          type: 'flow data set',
          refObjectId: 'flow-uuid-002',
          shortDescription: [],
        },
        exchangeDirection: 'Output',
        meanAmount: 1,
        amounts: [{ module: 'A1-A3', value: 1 }],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: 'ug-uuid-002',
          shortDescription: [],
        },
      },
    ];

    const xml = generateProcessXML(dataset);
    expect(xml).toContain('<common:other>');
    expect(xml).toContain('<epd:amount epd:module="A1-A3">1</epd:amount>');
  });

  // ---- Test 7: LCIAResults generated correctly ----
  it('generates LCIAResults with method reference and epd:amount elements', () => {
    dataset.lciaResults = [
      {
        methodRef: {
          type: 'LCIA method data set',
          refObjectId: 'lcia-uuid-001',
          version: '00.01.000',
          shortDescription: [{ lang: 'en', value: 'GWP total' }],
        },
        meanAmount: 42.5,
        amounts: [
          { module: 'A1-A3', value: 40.0 },
          { module: 'C4', value: 2.5 },
          { module: 'D', scenario: 'ScenB', value: -5.0 },
        ],
        unitGroupRef: {
          type: 'unit group data set',
          refObjectId: 'ug-lcia-001',
          shortDescription: [],
        },
      },
    ];

    const xml = generateProcessXML(dataset);

    // LCIAResults container
    expect(xml).toContain('<LCIAResults>');
    expect(xml).toContain('<LCIAResult>');

    // Method reference
    expect(xml).toContain('referenceToLCIAMethodDataSet');
    expect(xml).toContain('lcia-uuid-001');

    // Mean amount
    expect(xml).toContain('<meanAmount>42.5</meanAmount>');

    // Module amounts
    expect(xml).toContain('epd:module="A1-A3"');
    expect(xml).toContain('epd:module="C4"');
    expect(xml).toContain('epd:module="D" epd:scenario="ScenB"');
    expect(xml).toContain('>40<');
    expect(xml).toContain('>2.5<');
    expect(xml).toContain('>-5<');
  });

  it('omits LCIAResults section when there are no LCIA results', () => {
    dataset.lciaResults = [];
    const xml = generateProcessXML(dataset);
    expect(xml).not.toContain('<LCIAResults>');
  });

  // ---- Additional: XML escaping ----
  it('escapes special characters in text content', () => {
    dataset.processInfo.name = [{ lang: 'en', value: 'Product <A> & "B"' }];
    const xml = generateProcessXML(dataset);
    expect(xml).toContain('Product &lt;A&gt; &amp; &quot;B&quot;');
    expect(xml).not.toContain('Product <A>');
  });

  // ---- Additional: reference flow exchange ----
  it('renders the reference flow exchange with correct dataSetInternalID', () => {
    dataset.quantitativeReference.referenceToReferenceFlow = 5;
    const xml = generateProcessXML(dataset);
    // Should contain a reference exchange with that ID
    expect(xml).toContain('<referenceToReferenceFlow>5</referenceToReferenceFlow>');
    expect(xml).toContain('dataSetInternalID="5"');
  });
});
