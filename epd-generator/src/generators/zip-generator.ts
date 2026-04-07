import JSZip from 'jszip';
import type { EPDDataset } from '../model/epd-dataset';
import { generateProcessXML } from './xml/process-xml';

function buildFlowXML(uuid: string, name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<flowDataSet xmlns="http://lca.jrc.it/ILCD/Flow" xmlns:common="http://lca.jrc.it/ILCD/Common" version="1.1">
    <flowInformation>
        <dataSetInformation>
            <common:UUID>${uuid}</common:UUID>
            <name>
                <baseName xml:lang="en">${name}</baseName>
            </name>
        </dataSetInformation>
    </flowInformation>
</flowDataSet>`;
}

export async function generateILCDZip(dataset: EPDDataset): Promise<Blob> {
  const zip = new JSZip();
  const ilcd = zip.folder('ILCD')!;

  // Process XML
  const processXML = generateProcessXML(dataset);
  ilcd.folder('processes')!.file(`${dataset.meta.uuid}.xml`, processXML);

  // Flow XML stub
  const flowUuid = dataset.productFlow.uuid;
  const flowName = dataset.productFlow.name.find(s => s.lang === 'en')?.value
    ?? dataset.productFlow.name[0]?.value
    ?? '';
  const flowXML = buildFlowXML(flowUuid, flowName);
  ilcd.folder('flows')!.file(`${flowUuid}.xml`, flowXML);

  return zip.generateAsync({ type: 'blob' });
}
