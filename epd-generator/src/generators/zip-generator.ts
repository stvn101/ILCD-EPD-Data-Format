import JSZip from 'jszip';
import type { EPDDataset } from '../model/epd-dataset';
import type { Reference } from '../schema/types';
import { generateProcessXML } from './xml/process-xml';
import { generateFlowXML } from './xml/flow-xml';
import { generateContactXML } from './xml/contact-xml';
import { generateSourceXML } from './xml/source-xml';

function dedupe(refs: (Reference | null | undefined)[]): Reference[] {
  const map = new Map<string, Reference>();
  for (const r of refs) {
    if (!r || !r.refObjectId) continue;
    if (!map.has(r.refObjectId)) map.set(r.refObjectId, r);
  }
  return Array.from(map.values());
}

function collectUserContacts(d: EPDDataset): Reference[] {
  const o = d.organisations;
  const p = d.publicationAndOwnership;
  return dedupe([
    ...o.manufacturers.map(m => m.contact),
    o.commissioner,
    o.dataGenerator,
    o.programmeOperator,
    o.verifier,
    o.ownerOfDataSet,
    p.referenceToOwner,
    p.referenceToPublisher,
    p.registrationAuthority,
  ]);
}

function collectUserSources(d: EPDDataset): Reference[] {
  const sl = d.processInfo.serviceLife;
  const esl = d.processInfo.estimatedServiceLife;
  const s = d.sources;
  const p = d.publicationAndOwnership;
  return dedupe([
    sl?.standardRef,
    sl?.useConditionsDocumentationRef,
    esl?.standardRef,
    esl?.useConditionsDocumentationRef,
    s.pcr,
    ...s.backgroundDatabases,
    s.epdDocument,
    s.dataHandlingPrinciples,
    s.technologyPicture,
    s.technologyFlowDiagram,
    ...s.additionalSources,
    p.referenceToOriginalEPD,
  ]);
}

export async function generateILCDZip(dataset: EPDDataset): Promise<Blob> {
  const zip = new JSZip();
  const ilcd = zip.folder('ILCD')!;

  const processXML = generateProcessXML(dataset);
  ilcd.folder('processes')!.file(`${dataset.meta.uuid}.xml`, processXML);

  const flowXML = generateFlowXML(dataset);
  ilcd.folder('flows')!.file(`${dataset.productFlow.uuid}.xml`, flowXML);

  const contacts = collectUserContacts(dataset);
  if (contacts.length > 0) {
    const contactsFolder = ilcd.folder('contacts')!;
    for (const c of contacts) {
      contactsFolder.file(`${c.refObjectId}.xml`, generateContactXML(c, dataset));
    }
  }

  const sources = collectUserSources(dataset);
  if (sources.length > 0) {
    const sourcesFolder = ilcd.folder('sources')!;
    for (const s of sources) {
      sourcesFolder.file(`${s.refObjectId}.xml`, generateSourceXML(s, dataset));
    }
  }

  return zip.generateAsync({ type: 'blob' });
}
