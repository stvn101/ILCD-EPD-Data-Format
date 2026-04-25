import type { EPDDataset } from '../model/epd-dataset';
import type { Reference } from '../schema/types';
import type { ValidationIssue } from './types';

export interface ResolvedUuids {
  bundled: Set<string>;
  authoritative: Set<string>;
}

interface RefEntry {
  ref: Reference;
  field: string;
  step: number;
}

function walkReferences(d: EPDDataset): RefEntry[] {
  const out: RefEntry[] = [];
  const push = (ref: Reference | null | undefined, field: string, step: number) => {
    if (ref && ref.refObjectId) out.push({ ref, field, step });
  };

  // processInfo (step 2)
  const sl = d.processInfo.serviceLife;
  if (sl) {
    push(sl.standardRef, 'processInfo.serviceLife.standardRef', 2);
    push(sl.useConditionsDocumentationRef, 'processInfo.serviceLife.useConditionsDocumentationRef', 2);
  }
  const esl = d.processInfo.estimatedServiceLife;
  if (esl) {
    push(esl.standardRef, 'processInfo.estimatedServiceLife.standardRef', 2);
    push(esl.useConditionsDocumentationRef, 'processInfo.estimatedServiceLife.useConditionsDocumentationRef', 2);
  }

  // productFlow (step 3)
  push(d.productFlow.declaredUnit.flowPropertyRef, 'productFlow.declaredUnit.flowPropertyRef', 3);
  push(d.productFlow.declaredUnit.unitGroupRef, 'productFlow.declaredUnit.unitGroupRef', 3);
  push(d.productFlow.isA, 'productFlow.isA', 3);

  // exchanges + lciaResults (step 5)
  d.exchanges.forEach((ex, i) => {
    push(ex.flowRef, `exchanges[${i}].flowRef`, 5);
    push(ex.unitGroupRef, `exchanges[${i}].unitGroupRef`, 5);
  });
  d.lciaResults.forEach((r, i) => {
    push(r.methodRef, `lciaResults[${i}].methodRef`, 5);
    push(r.unitGroupRef, `lciaResults[${i}].unitGroupRef`, 5);
  });

  // organisations + administrative (step 4)
  d.organisations.manufacturers.forEach((m, i) => {
    push(m.contact, `organisations.manufacturers[${i}].contact`, 4);
  });
  push(d.organisations.commissioner, 'organisations.commissioner', 4);
  push(d.organisations.dataGenerator, 'organisations.dataGenerator', 4);
  push(d.organisations.programmeOperator, 'organisations.programmeOperator', 4);
  push(d.organisations.verifier, 'organisations.verifier', 4);
  push(d.organisations.ownerOfDataSet, 'organisations.ownerOfDataSet', 4);
  d.complianceDeclarations.forEach((c, i) => {
    push(c.system, `complianceDeclarations[${i}].system`, 4);
  });
  d.dataEntryBy.referenceToDataSetFormat.forEach((f, i) => {
    push(f, `dataEntryBy.referenceToDataSetFormat[${i}]`, 4);
  });

  // publicationAndOwnership + sources (step 6)
  const p = d.publicationAndOwnership;
  push(p.registrationAuthority, 'publicationAndOwnership.registrationAuthority', 6);
  push(p.referenceToOwner, 'publicationAndOwnership.referenceToOwner', 6);
  push(p.referenceToPublisher, 'publicationAndOwnership.referenceToPublisher', 6);
  push(p.referenceToOriginalEPD, 'publicationAndOwnership.referenceToOriginalEPD', 6);
  const s = d.sources;
  push(s.pcr, 'sources.pcr', 6);
  s.backgroundDatabases.forEach((r, i) => {
    push(r, `sources.backgroundDatabases[${i}]`, 6);
  });
  push(s.epdDocument, 'sources.epdDocument', 6);
  push(s.dataHandlingPrinciples, 'sources.dataHandlingPrinciples', 6);
  push(s.technologyPicture, 'sources.technologyPicture', 6);
  push(s.technologyFlowDiagram, 'sources.technologyFlowDiagram', 6);
  s.additionalSources.forEach((r, i) => {
    push(r, `sources.additionalSources[${i}]`, 6);
  });

  return out;
}

function dedupeRef(refs: (Reference | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const r of refs) {
    if (r && r.refObjectId) set.add(r.refObjectId);
  }
  return Array.from(set);
}

/**
 * UUIDs that will be present in the exported ILCD ZIP — process, flow, plus all
 * user-entered contact/source UUIDs walked from the dataset.
 */
export function getBundledUuids(d: EPDDataset): Set<string> {
  const ids = new Set<string>();
  if (d.meta.uuid) ids.add(d.meta.uuid);
  if (d.productFlow.uuid) ids.add(d.productFlow.uuid);

  const contactRefs: (Reference | null)[] = [
    ...d.organisations.manufacturers.map(m => m.contact),
    d.organisations.commissioner,
    d.organisations.dataGenerator,
    d.organisations.programmeOperator,
    d.organisations.verifier,
    d.organisations.ownerOfDataSet,
    d.publicationAndOwnership.referenceToOwner,
    d.publicationAndOwnership.referenceToPublisher,
    d.publicationAndOwnership.registrationAuthority,
  ];
  for (const id of dedupeRef(contactRefs)) ids.add(id);

  const sourceRefs: (Reference | null | undefined)[] = [
    d.processInfo.serviceLife?.standardRef,
    d.processInfo.serviceLife?.useConditionsDocumentationRef,
    d.processInfo.estimatedServiceLife?.standardRef,
    d.processInfo.estimatedServiceLife?.useConditionsDocumentationRef,
    d.sources.pcr,
    ...d.sources.backgroundDatabases,
    d.sources.epdDocument,
    d.sources.dataHandlingPrinciples,
    d.sources.technologyPicture,
    d.sources.technologyFlowDiagram,
    ...d.sources.additionalSources,
    d.publicationAndOwnership.referenceToOriginalEPD,
  ];
  for (const id of dedupeRef(sourceRefs)) ids.add(id);

  return ids;
}

export function findUnresolvedReferences(
  dataset: EPDDataset,
  resolved: ResolvedUuids,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const { ref, field, step } of walkReferences(dataset)) {
    if (resolved.bundled.has(ref.refObjectId)) continue;
    if (resolved.authoritative.has(ref.refObjectId)) continue;
    issues.push({
      severity: 'warning',
      step,
      field,
      message: `Referenced UUID ${ref.refObjectId} is not bundled in the ZIP and is not a known authoritative dataset.`,
    });
  }
  return issues;
}
