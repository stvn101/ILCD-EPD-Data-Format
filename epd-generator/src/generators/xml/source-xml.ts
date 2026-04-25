import type { EPDDataset } from '../../model/epd-dataset';
import type { Reference } from '../../schema/types';
import { NS } from '../../schema/namespaces';
import { xmlEscape, renderMultiLang } from './xml-utils';

export function generateSourceXML(ref: Reference, dataset: EPDDataset): string {
  const shortNameLines = renderMultiLang('common:shortName', ref.shortDescription, '            ');
  const dataSetVersion = ref.version ?? '00.01.000';

  const sections: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<sourceDataSet xmlns="${NS.SOURCE}"`,
    `  xmlns:common="${NS.COMMON}"`,
    `  xmlns:xsi="${NS.XSI}"`,
    `  version="1.1">`,
    `  <sourceInformation>`,
    `    <dataSetInformation>`,
    `      <common:UUID>${xmlEscape(ref.refObjectId)}</common:UUID>`,
    shortNameLines,
    `      <classificationInformation>`,
    `        <common:classification>`,
    `          <common:class level="0">Other source types</common:class>`,
    `        </common:classification>`,
    `      </classificationInformation>`,
    `    </dataSetInformation>`,
    `  </sourceInformation>`,
    `  <administrativeInformation>`,
    `    <dataEntryBy>`,
    `      <common:timeStamp>${xmlEscape(dataset.dataEntryBy.timestamp)}</common:timeStamp>`,
    `    </dataEntryBy>`,
    `    <publicationAndOwnership>`,
    `      <common:dataSetVersion>${xmlEscape(dataSetVersion)}</common:dataSetVersion>`,
    `    </publicationAndOwnership>`,
    `  </administrativeInformation>`,
    `</sourceDataSet>`,
  ];

  return sections.filter(s => s !== '').join('\n');
}
