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
