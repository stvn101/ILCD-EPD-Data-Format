import type { EPDDataset, MatMLProperty, MatMLPropertyName } from '../../model/epd-dataset';
import { NS } from '../../schema/namespaces';
import { xmlEscape, renderMultiLang, renderReference } from './xml-utils';

// ---- MatML property table --------------------------------------------
// IDs follow the Technical Details guide and the v1.3 sample flow:
//   pr1=gross density, pr2=grammage, pr3=bulk density, pr4=layer thickness,
//   pr5=productiveness, pr6=linear density, pr7=conversion factor to 1 kg.
// Unit name + description match the sample's single-Unit form, which is what
// real soda4LCA exports use (the more elaborate sub-Unit form in the
// Technical Details guide is also valid but unnecessary).

interface MatMLPropertyMeta {
  id: string;
  unitName: string;
  unitDescription: string;
}

const MATML_PROPERTIES: Record<MatMLPropertyName, MatMLPropertyMeta> = {
  'gross density': { id: 'pr1', unitName: 'kg/m^3', unitDescription: 'kilograms per cubic metre' },
  grammage: { id: 'pr2', unitName: 'kg/m^2', unitDescription: 'kilograms per square metre' },
  'bulk density': { id: 'pr3', unitName: 'kg/m^3', unitDescription: 'kilograms per cubic metre' },
  'layer thickness': { id: 'pr4', unitName: 'm', unitDescription: 'metres' },
  productiveness: { id: 'pr5', unitName: 'm^2', unitDescription: 'square metres' },
  'linear density': { id: 'pr6', unitName: 'kg/m', unitDescription: 'kilograms per metre' },
  'conversion factor to 1 kg': { id: 'pr7', unitName: '-', unitDescription: 'none' },
};

function groupByMaterialName(properties: MatMLProperty[]): Map<string, MatMLProperty[]> {
  const groups = new Map<string, MatMLProperty[]>();
  for (const p of properties) {
    const key = p.materialName || '';
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }
  return groups;
}

function renderBulkDetails(materialName: string, properties: MatMLProperty[], indent: string): string {
  const inner = indent + '  ';
  const innerInner = inner + '  ';
  const lines: string[] = [];
  lines.push(`${indent}<mat:BulkDetails>`);
  lines.push(`${inner}<mat:Name>${xmlEscape(materialName)}</mat:Name>`);
  for (const p of properties) {
    const meta = MATML_PROPERTIES[p.propertyName];
    if (!meta) continue;
    lines.push(`${inner}<mat:PropertyData property="${meta.id}">`);
    lines.push(`${innerInner}<mat:Data format="float">${p.value}</mat:Data>`);
    lines.push(`${inner}</mat:PropertyData>`);
  }
  lines.push(`${indent}</mat:BulkDetails>`);
  return lines.join('\n');
}

function renderPropertyDetails(propertyName: MatMLPropertyName, indent: string): string {
  const meta = MATML_PROPERTIES[propertyName];
  if (!meta) return '';
  const inner = indent + '  ';
  const innerInner = inner + '  ';
  return [
    `${indent}<mat:PropertyDetails id="${meta.id}">`,
    `${inner}<mat:Name>${xmlEscape(propertyName)}</mat:Name>`,
    `${inner}<mat:Units description="${xmlEscape(meta.unitDescription)}" name="${xmlEscape(meta.unitName)}">`,
    `${innerInner}<mat:Unit>`,
    `${innerInner}  <mat:Name>${xmlEscape(meta.unitName)}</mat:Name>`,
    `${innerInner}</mat:Unit>`,
    `${inner}</mat:Units>`,
    `${indent}</mat:PropertyDetails>`,
  ].join('\n');
}

function renderMatML(properties: MatMLProperty[], indent: string): string {
  if (properties.length === 0) return '';

  const inner = indent + '  ';
  const innerInner = inner + '  ';
  const groups = groupByMaterialName(properties);

  // BulkDetails: one per material name
  const materialBlocks: string[] = [];
  materialBlocks.push(`${inner}<mat:Material>`);
  for (const [materialName, props] of groups) {
    materialBlocks.push(renderBulkDetails(materialName, props, innerInner));
  }
  materialBlocks.push(`${inner}</mat:Material>`);

  // Metadata: one PropertyDetails per unique property name used
  const usedProperties = new Set<MatMLPropertyName>();
  for (const p of properties) usedProperties.add(p.propertyName);

  const metadataBlocks: string[] = [];
  metadataBlocks.push(`${inner}<mat:Metadata>`);
  for (const name of usedProperties) {
    const block = renderPropertyDetails(name, innerInner);
    if (block) metadataBlocks.push(block);
  }
  metadataBlocks.push(`${inner}</mat:Metadata>`);

  return [
    `${indent}<mat:MatML_Doc xmlns:mat="${NS.MATML}">`,
    ...materialBlocks,
    ...metadataBlocks,
    `${indent}</mat:MatML_Doc>`,
  ].join('\n');
}

// ---- Main flow XML generator ------------------------------------------

export function generateFlowXML(dataset: EPDDataset): string {
  const flow = dataset.productFlow;
  const declaredUnit = flow.declaredUnit;

  const nameLines = renderMultiLang('baseName', flow.name, '        ');

  const matml = renderMatML(flow.materialProperties, '          ');
  const matmlBlock = matml
    ? `      <common:other>\n${matml}\n      </common:other>`
    : '';

  // Reference flow property = the declared unit's flow property at internal id 0
  const flowPropRef = renderReference(
    'referenceToFlowPropertyDataSet',
    declaredUnit.flowPropertyRef,
    '        ',
  );
  const flowPropertyBlock =
    declaredUnit.flowPropertyRef.refObjectId
      ? [
          `      <flowProperty dataSetInternalID="0">`,
          flowPropRef,
          `        <meanValue>1.0</meanValue>`,
          `      </flowProperty>`,
        ].join('\n')
      : '';

  const sections: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<flowDataSet xmlns="${NS.FLOW}"`,
    `  xmlns:common="${NS.COMMON}"`,
    `  xmlns:xsi="${NS.XSI}"`,
    `  version="1.1">`,
    `  <flowInformation>`,
    `    <dataSetInformation>`,
    `      <common:UUID>${xmlEscape(flow.uuid)}</common:UUID>`,
    `      <name>`,
    nameLines,
    `      </name>`,
    matmlBlock,
    `    </dataSetInformation>`,
    `    <quantitativeReference>`,
    `      <referenceToReferenceFlowProperty>0</referenceToReferenceFlowProperty>`,
    `    </quantitativeReference>`,
    `  </flowInformation>`,
    `  <modellingAndValidation>`,
    `    <LCIMethod>`,
    `      <typeOfDataSet>Product flow</typeOfDataSet>`,
    `    </LCIMethod>`,
    `  </modellingAndValidation>`,
    `  <administrativeInformation>`,
    `    <dataEntryBy>`,
    `      <common:timeStamp>${xmlEscape(dataset.dataEntryBy.timestamp)}</common:timeStamp>`,
    `    </dataEntryBy>`,
    `    <publicationAndOwnership>`,
    `      <common:dataSetVersion>${xmlEscape(dataset.publicationAndOwnership.dataSetVersion)}</common:dataSetVersion>`,
    `    </publicationAndOwnership>`,
    `  </administrativeInformation>`,
    flowPropertyBlock
      ? `  <flowProperties>\n${flowPropertyBlock}\n  </flowProperties>`
      : `  <flowProperties/>`,
    `</flowDataSet>`,
  ];

  return sections.filter(s => s !== '').join('\n');
}
