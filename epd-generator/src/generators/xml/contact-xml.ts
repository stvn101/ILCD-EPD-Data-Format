import type { EPDDataset } from '../../model/epd-dataset';
import type { Reference } from '../../schema/types';
import { NS } from '../../schema/namespaces';
import { xmlEscape, renderMultiLang } from './xml-utils';

export function generateContactXML(ref: Reference, dataset: EPDDataset): string {
  const shortNameLines = renderMultiLang('common:shortName', ref.shortDescription, '            ');
  const nameLines = renderMultiLang('common:name', ref.shortDescription, '            ');
  const dataSetVersion = ref.version ?? '00.01.000';

  const sections: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<contactDataSet xmlns="${NS.CONTACT}"`,
    `  xmlns:common="${NS.COMMON}"`,
    `  xmlns:xsi="${NS.XSI}"`,
    `  version="1.1">`,
    `  <contactInformation>`,
    `    <dataSetInformation>`,
    `      <common:UUID>${xmlEscape(ref.refObjectId)}</common:UUID>`,
    shortNameLines,
    nameLines,
    `      <classificationInformation>`,
    `        <common:classification name="ILCD">`,
    `          <common:class level="0" classId="2">Organisations</common:class>`,
    `        </common:classification>`,
    `      </classificationInformation>`,
    `    </dataSetInformation>`,
    `  </contactInformation>`,
    `  <administrativeInformation>`,
    `    <dataEntryBy>`,
    `      <common:timeStamp>${xmlEscape(dataset.dataEntryBy.timestamp)}</common:timeStamp>`,
    `    </dataEntryBy>`,
    `    <publicationAndOwnership>`,
    `      <common:dataSetVersion>${xmlEscape(dataSetVersion)}</common:dataSetVersion>`,
    `    </publicationAndOwnership>`,
    `  </administrativeInformation>`,
    `</contactDataSet>`,
  ];

  return sections.filter(s => s !== '').join('\n');
}
