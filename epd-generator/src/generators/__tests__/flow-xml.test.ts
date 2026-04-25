import { describe, it, expect, beforeEach } from 'vitest';
import { generateFlowXML } from '../xml/flow-xml';
import { createEmptyDataset } from '../../model/epd-dataset';
import type { EPDDataset } from '../../model/epd-dataset';
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

describe('generateFlowXML', () => {
  let dataset: EPDDataset;

  beforeEach(() => {
    dataset = createEmptyDataset('+A2/EF3.1');
    dataset.productFlow.uuid = 'flow-uuid-aaaa-bbbb';
    dataset.productFlow.name = [
      { lang: 'en', value: 'wood panel' },
      { lang: 'de', value: 'Holzpanel' },
    ];
    dataset.productFlow.declaredUnit = {
      flowPropertyRef: {
        type: 'flow property data set',
        refObjectId: '93a60a56-a3c8-11da-a746-0800200b9a66',
        version: '03.00.000',
        shortDescription: [
          { lang: 'en', value: 'Mass' },
          { lang: 'de', value: 'Masse' },
        ],
      },
      unitGroupRef: {
        type: 'unit group data set',
        refObjectId: '93a60a57-a4c8-11da-a746-0800200c9a66',
        shortDescription: [{ lang: 'en', value: 'kg' }],
      },
    };
  });

  it('produces parseable XML with the correct root and namespaces', () => {
    const xml = generateFlowXML(dataset);
    const doc = parseXML(xml);

    expect(doc.documentElement.localName).toBe('flowDataSet');
    expect(xml).toContain(`xmlns="${NS.FLOW}"`);
    expect(xml).toContain(`xmlns:common="${NS.COMMON}"`);
  });

  it('emits the UUID and multilingual baseName', () => {
    const xml = generateFlowXML(dataset);
    const doc = parseXML(xml);

    const uuid = doc.getElementsByTagNameNS(NS.COMMON, 'UUID')[0];
    expect(uuid?.textContent).toBe('flow-uuid-aaaa-bbbb');

    const baseNames = doc.getElementsByTagNameNS(NS.FLOW, 'baseName');
    expect(baseNames.length).toBe(2);
    const enName = Array.from(baseNames).find(el => el.getAttribute('xml:lang') === 'en');
    const deName = Array.from(baseNames).find(el => el.getAttribute('xml:lang') === 'de');
    expect(enName?.textContent).toBe('wood panel');
    expect(deName?.textContent).toBe('Holzpanel');
  });

  it('typeOfDataSet is "Product flow"', () => {
    const xml = generateFlowXML(dataset);
    expect(xml).toContain('<typeOfDataSet>Product flow</typeOfDataSet>');
  });

  it('emits the declared-unit flow property at dataSetInternalID="0"', () => {
    const xml = generateFlowXML(dataset);

    expect(xml).toContain('<flowProperty dataSetInternalID="0">');
    expect(xml).toContain('refObjectId="93a60a56-a3c8-11da-a746-0800200b9a66"');
    expect(xml).toContain('<meanValue>1.0</meanValue>');
    expect(xml).toContain('<referenceToReferenceFlowProperty>0</referenceToReferenceFlowProperty>');
  });

  it('emits MatML for material properties — gross density and grammage', () => {
    dataset.productFlow.materialProperties = [
      { propertyName: 'gross density', value: 650.0, materialName: 'wood panel' },
      { propertyName: 'grammage', value: 1.38696, materialName: 'wood panel' },
    ];
    const xml = generateFlowXML(dataset);

    // MatML wrapper
    expect(xml).toContain('<mat:MatML_Doc xmlns:mat="http://www.matml.org/">');

    // BulkDetails has the material name
    expect(xml).toContain('<mat:Name>wood panel</mat:Name>');

    // PropertyData entries reference the right pr IDs (gross density=pr1, grammage=pr2)
    expect(xml).toContain('<mat:PropertyData property="pr1">');
    expect(xml).toContain('<mat:Data format="float">650</mat:Data>');
    expect(xml).toContain('<mat:PropertyData property="pr2">');
    expect(xml).toContain('<mat:Data format="float">1.38696</mat:Data>');

    // Metadata declares each property used
    expect(xml).toContain('<mat:PropertyDetails id="pr1">');
    expect(xml).toContain('<mat:Name>gross density</mat:Name>');
    expect(xml).toContain('description="kilograms per cubic metre" name="kg/m^3"');
    expect(xml).toContain('<mat:PropertyDetails id="pr2">');
    expect(xml).toContain('<mat:Name>grammage</mat:Name>');
    expect(xml).toContain('description="kilograms per square metre" name="kg/m^2"');
  });

  it('emits one BulkDetails per material name when properties span multiple materials', () => {
    dataset.productFlow.materialProperties = [
      { propertyName: 'gross density', value: 650.0, materialName: 'wood panel' },
      { propertyName: 'gross density', value: 1200.0, materialName: 'glue layer' },
      { propertyName: 'layer thickness', value: 0.025, materialName: 'wood panel' },
    ];
    const xml = generateFlowXML(dataset);

    // Two BulkDetails blocks, one per material
    const woodMatch = xml.match(/<mat:BulkDetails>\s*<mat:Name>wood panel<\/mat:Name>/g);
    const glueMatch = xml.match(/<mat:BulkDetails>\s*<mat:Name>glue layer<\/mat:Name>/g);
    expect(woodMatch?.length).toBe(1);
    expect(glueMatch?.length).toBe(1);

    // Both density values appear
    expect(xml).toContain('>650<');
    expect(xml).toContain('>1200<');
    expect(xml).toContain('>0.025<');

    // Metadata: one PropertyDetails per unique property (gross density, layer thickness)
    expect(xml).toContain('<mat:PropertyDetails id="pr1">');
    expect(xml).toContain('<mat:PropertyDetails id="pr4">');
  });

  it('omits the MatML_Doc block entirely when no material properties are present', () => {
    dataset.productFlow.materialProperties = [];
    const xml = generateFlowXML(dataset);

    expect(xml).not.toContain('MatML_Doc');
    expect(xml).not.toContain('BulkDetails');
    expect(xml).not.toContain('PropertyDetails');
  });

  it('escapes special characters in flow names', () => {
    dataset.productFlow.name = [{ lang: 'en', value: 'Panel <X> & "Y"' }];
    const xml = generateFlowXML(dataset);

    expect(xml).toContain('Panel &lt;X&gt; &amp; &quot;Y&quot;');
    expect(xml).not.toContain('Panel <X>');
  });

  it('emits empty <flowProperties/> when declared unit has no UUID', () => {
    dataset.productFlow.declaredUnit = {
      flowPropertyRef: { type: 'flow property data set', refObjectId: '', shortDescription: [] },
      unitGroupRef: { type: 'unit group data set', refObjectId: '', shortDescription: [] },
    };
    const xml = generateFlowXML(dataset);

    expect(xml).toContain('<flowProperties/>');
    expect(xml).not.toContain('<flowProperty dataSetInternalID');
  });

  it('renders all 7 supported MatML property names with their pr IDs', () => {
    dataset.productFlow.materialProperties = [
      { propertyName: 'gross density', value: 1, materialName: 'm' },
      { propertyName: 'grammage', value: 2, materialName: 'm' },
      { propertyName: 'bulk density', value: 3, materialName: 'm' },
      { propertyName: 'layer thickness', value: 4, materialName: 'm' },
      { propertyName: 'productiveness', value: 5, materialName: 'm' },
      { propertyName: 'linear density', value: 6, materialName: 'm' },
      { propertyName: 'conversion factor to 1 kg', value: 7, materialName: 'm' },
    ];
    const xml = generateFlowXML(dataset);

    expect(xml).toContain('<mat:PropertyDetails id="pr1">');
    expect(xml).toContain('<mat:PropertyDetails id="pr2">');
    expect(xml).toContain('<mat:PropertyDetails id="pr3">');
    expect(xml).toContain('<mat:PropertyDetails id="pr4">');
    expect(xml).toContain('<mat:PropertyDetails id="pr5">');
    expect(xml).toContain('<mat:PropertyDetails id="pr6">');
    expect(xml).toContain('<mat:PropertyDetails id="pr7">');

    expect(xml).toContain('<mat:Name>conversion factor to 1 kg</mat:Name>');
    expect(xml).toContain('description="none" name="-"');
  });
});
