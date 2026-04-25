import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { generateILCDZip } from '../zip-generator';
import { createEmptyDataset } from '../../model/epd-dataset';
import type { EPDDataset } from '../../model/epd-dataset';
import type { Reference } from '../../schema/types';
import { NS } from '../../schema/namespaces';

function parseXML(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error: ${parseError.textContent}`);
  }
  return doc;
}

function makeContact(uuid: string, label: string): Reference {
  return {
    type: 'contact data set',
    refObjectId: uuid,
    shortDescription: [{ lang: 'en', value: label }],
  };
}

function makeSource(uuid: string, label: string): Reference {
  return {
    type: 'source data set',
    refObjectId: uuid,
    shortDescription: [{ lang: 'en', value: label }],
  };
}

async function loadZip(blob: Blob): Promise<JSZip> {
  const buf = await blob.arrayBuffer();
  return JSZip.loadAsync(buf);
}

describe('generateILCDZip', () => {
  let dataset: EPDDataset;

  beforeEach(() => {
    dataset = createEmptyDataset('+A2/EF3.1');
    dataset.meta.uuid = 'process-uuid-1234';
    dataset.productFlow.uuid = 'flow-uuid-5678';
  });

  it('always emits process and flow XMLs at the expected paths', async () => {
    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    expect(zip.file('ILCD/processes/process-uuid-1234.xml')).not.toBeNull();
    expect(zip.file('ILCD/flows/flow-uuid-5678.xml')).not.toBeNull();
  });

  it('emits one contact XML per user-entered contact reference', async () => {
    dataset.organisations.manufacturers = [
      {
        contact: makeContact('contact-mfr', 'Wood Products S.A.'),
        isProvidingData: true,
        sites: [],
      },
    ];
    dataset.organisations.verifier = makeContact('contact-vrf', 'Verifier GmbH');

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const contactFiles = Object.keys(zip.files).filter(p =>
      p.startsWith('ILCD/contacts/') && p.endsWith('.xml'),
    );
    expect(contactFiles.sort()).toEqual([
      'ILCD/contacts/contact-mfr.xml',
      'ILCD/contacts/contact-vrf.xml',
    ]);
  });

  it('emits one source XML per user-entered source reference', async () => {
    dataset.sources.pcr = makeSource('source-pcr', 'PCR Construction Products');
    dataset.sources.backgroundDatabases = [makeSource('source-db', 'GaBi database')];

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const sourceFiles = Object.keys(zip.files).filter(p =>
      p.startsWith('ILCD/sources/') && p.endsWith('.xml'),
    );
    expect(sourceFiles.sort()).toEqual([
      'ILCD/sources/source-db.xml',
      'ILCD/sources/source-pcr.xml',
    ]);
  });

  it('dedupes contact references that share a refObjectId', async () => {
    const shared = makeContact('shared-uuid', 'Acme Co.');
    dataset.organisations.manufacturers = [
      { contact: shared, isProvidingData: true, sites: [] },
      { contact: shared, isProvidingData: false, sites: [] },
    ];
    dataset.organisations.dataGenerator = shared;

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const contactFiles = Object.keys(zip.files).filter(p =>
      p.startsWith('ILCD/contacts/') && p.endsWith('.xml'),
    );
    expect(contactFiles).toEqual(['ILCD/contacts/shared-uuid.xml']);
  });

  it('skips references with empty refObjectId', async () => {
    dataset.organisations.verifier = {
      type: 'contact data set',
      refObjectId: '',
      shortDescription: [],
    };
    dataset.sources.pcr = { type: 'source data set', refObjectId: '', shortDescription: [] };

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const contactFiles = Object.keys(zip.files).filter(p => p.startsWith('ILCD/contacts/'));
    const sourceFiles = Object.keys(zip.files).filter(p => p.startsWith('ILCD/sources/'));
    expect(contactFiles).toHaveLength(0);
    expect(sourceFiles).toHaveLength(0);
  });

  it('does NOT bundle authoritative refs (compliance system, dataSetFormat)', async () => {
    dataset.complianceDeclarations = [
      {
        system: makeSource('authoritative-compliance-uuid', 'EN 15804+A2'),
      },
    ];
    dataset.dataEntryBy.referenceToDataSetFormat = [
      makeSource('a97a0155-0234-4b87-b4ce-a45da52f2a40', 'ILCD format'),
    ];

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const sourceFiles = Object.keys(zip.files).filter(p =>
      p.startsWith('ILCD/sources/') && p.endsWith('.xml'),
    );
    expect(sourceFiles).toHaveLength(0);
  });

  it('generated contact XML has the right shape (root, namespace, UUID, shortName)', async () => {
    dataset.organisations.verifier = makeContact('contact-uuid-xyz', 'Verifier GmbH');

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const xml = await zip.file('ILCD/contacts/contact-uuid-xyz.xml')!.async('text');
    const doc = parseXML(xml);

    expect(doc.documentElement.localName).toBe('contactDataSet');
    expect(xml).toContain(`xmlns="${NS.CONTACT}"`);
    expect(xml).toContain(`xmlns:common="${NS.COMMON}"`);

    const uuid = doc.getElementsByTagNameNS(NS.COMMON, 'UUID')[0];
    expect(uuid?.textContent).toBe('contact-uuid-xyz');

    const shortNames = doc.getElementsByTagNameNS(NS.COMMON, 'shortName');
    expect(shortNames.length).toBe(1);
    expect(shortNames[0]?.textContent).toBe('Verifier GmbH');

    const names = doc.getElementsByTagNameNS(NS.COMMON, 'name');
    expect(names.length).toBe(1);
    expect(names[0]?.textContent).toBe('Verifier GmbH');
  });

  it('generated source XML has the right shape (root, namespace, UUID, shortName)', async () => {
    dataset.sources.pcr = makeSource('source-uuid-abc', 'PCR Construction Products');

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const xml = await zip.file('ILCD/sources/source-uuid-abc.xml')!.async('text');
    const doc = parseXML(xml);

    expect(doc.documentElement.localName).toBe('sourceDataSet');
    expect(xml).toContain(`xmlns="${NS.SOURCE}"`);
    expect(xml).toContain(`xmlns:common="${NS.COMMON}"`);

    const uuid = doc.getElementsByTagNameNS(NS.COMMON, 'UUID')[0];
    expect(uuid?.textContent).toBe('source-uuid-abc');

    const shortNames = doc.getElementsByTagNameNS(NS.COMMON, 'shortName');
    expect(shortNames.length).toBe(1);
    expect(shortNames[0]?.textContent).toBe('PCR Construction Products');
  });

  it('emits multilingual shortName entries when reference has multiple languages', async () => {
    dataset.sources.pcr = {
      type: 'source data set',
      refObjectId: 'multi-lang-source',
      shortDescription: [
        { lang: 'en', value: 'EN 15804+A2' },
        { lang: 'de', value: 'EN 15804+A2 (Deutsch)' },
      ],
    };

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const xml = await zip.file('ILCD/sources/multi-lang-source.xml')!.async('text');
    expect(xml).toContain('xml:lang="en">EN 15804+A2</common:shortName>');
    expect(xml).toContain('xml:lang="de">EN 15804+A2 (Deutsch)</common:shortName>');
  });

  it('uses ref.version when present, falls back to 00.01.000', async () => {
    dataset.sources.pcr = {
      type: 'source data set',
      refObjectId: 'versioned-source',
      version: '02.05.001',
      shortDescription: [{ lang: 'en', value: 'PCR' }],
    };
    dataset.organisations.verifier = makeContact('unversioned-contact', 'Verifier');

    const blob = await generateILCDZip(dataset);
    const zip = await loadZip(blob);

    const sourceXml = await zip.file('ILCD/sources/versioned-source.xml')!.async('text');
    expect(sourceXml).toContain('<common:dataSetVersion>02.05.001</common:dataSetVersion>');

    const contactXml = await zip.file('ILCD/contacts/unversioned-contact.xml')!.async('text');
    expect(contactXml).toContain('<common:dataSetVersion>00.01.000</common:dataSetVersion>');
  });
});
