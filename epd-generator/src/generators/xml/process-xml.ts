import type {
  EPDDataset,
  Exchange,
  LCIAResult,
  Material,
  Substance,
  Component,
  RangeValue,
  ContentDeclaration,
  ProductId,
  ServiceLife,
  UseConditionFactor,
  ScenarioData,
  EolScenarioData,
  PCRCompliance,
  Manufacturer,
  Site,
} from '../../model/epd-dataset';
import { NS } from '../../schema/namespaces';
import { STANDARD_CONFIGS } from '../../schema/standard-configs';
import { xmlEscape, renderMultiLang, renderReference } from './xml-utils';

// ---- Namespace helpers ------------------------------------------------

function buildRootAttributes(dataset: EPDDataset): string {
  const cfg = STANDARD_CONFIGS[dataset.meta.standardVersion];
  const hasEpd2013 = cfg.namespaces.includes(NS.EPD_2013);
  const hasEpd2019 = cfg.namespaces.includes(NS.EPD_2019);
  const hasEpd2024 = cfg.namespaces.includes(NS.EPD_2024);

  const attrs: string[] = [
    `xmlns="${NS.PROCESS}"`,
    `xmlns:common="${NS.COMMON}"`,
    `xmlns:xsi="${NS.XSI}"`,
  ];

  if (hasEpd2013) attrs.push(`xmlns:epd="${NS.EPD_2013}"`);
  if (hasEpd2019) attrs.push(`xmlns:epd2="${NS.EPD_2019}"`);
  if (hasEpd2024) attrs.push(`xmlns:epd24="${NS.EPD_2024}"`);
  if (hasEpd2019) attrs.push(`epd2:epd-version="1.3"`);

  return attrs.join('\n  ');
}

// ---- Section helpers --------------------------------------------------

function renderExchange(ex: Exchange): string {
  const i2 = '        ';
  const i3 = '          ';
  const i4 = '            ';

  const flowRef = renderReference('referenceToFlowDataSet', ex.flowRef, i3);

  const amountElems = ex.amounts.map(a => {
    const scenAttr = a.scenario ? ` epd:scenario="${xmlEscape(a.scenario)}"` : '';
    return `${i4}<epd:amount epd:module="${xmlEscape(a.module)}"${scenAttr}>${a.value}</epd:amount>`;
  });

  const commonOther =
    amountElems.length > 0
      ? `${i3}<common:other>\n${amountElems.join('\n')}\n${i3}</common:other>`
      : '';

  const lines = [
    `${i2}<exchange dataSetInternalID="${ex.dataSetInternalID}">`,
    flowRef,
    `${i3}<functionType>General reminder flow</functionType>`,
    `${i3}<exchangeDirection>${xmlEscape(ex.exchangeDirection)}</exchangeDirection>`,
    `${i3}<meanAmount>${ex.meanAmount}</meanAmount>`,
    commonOther,
    `${i2}</exchange>`,
  ].filter(l => l !== '');

  return lines.join('\n');
}

function renderReferenceExchange(internalID: number): string {
  const i2 = '        ';
  return `${i2}<exchange dataSetInternalID="${internalID}">\n${i2}</exchange>`;
}

function renderLCIAResult(result: LCIAResult): string {
  const i2 = '        ';
  const i3 = '          ';
  const i4 = '            ';

  const methodRef = renderReference('referenceToLCIAMethodDataSet', result.methodRef, i3);

  const amountElems = result.amounts.map(a => {
    const scenAttr = a.scenario ? ` epd:scenario="${xmlEscape(a.scenario)}"` : '';
    return `${i4}<epd:amount epd:module="${xmlEscape(a.module)}"${scenAttr}>${a.value}</epd:amount>`;
  });

  const commonOther =
    amountElems.length > 0
      ? `${i3}<common:other>\n${amountElems.join('\n')}\n${i3}</common:other>`
      : '';

  const lines = [
    `${i2}<LCIAResult>`,
    methodRef,
    `${i3}<meanAmount>${result.meanAmount}</meanAmount>`,
    commonOther,
    `${i2}</LCIAResult>`,
  ].filter(l => l !== '');

  return lines.join('\n');
}

function opt(s: string): string {
  return s.trim() ? s : '';
}

// ---- Content declaration (epd2:2019) ----------------------------------

function renderRangeValue(tag: string, rv: RangeValue, indent: string): string {
  const attrs: string[] = [];
  if (rv.value !== undefined) attrs.push(`epd2:value="${rv.value}"`);
  if (rv.lowerValue !== undefined) attrs.push(`epd2:lowerValue="${rv.lowerValue}"`);
  if (rv.upperValue !== undefined) attrs.push(`epd2:upperValue="${rv.upperValue}"`);
  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  return `${indent}<${tag}${attrStr}/>`;
}

/** Render attributes shared by epd2:material and epd2:substance. */
function renderSubstanceMaterialAttrs(m: Material | Substance): string {
  const attrs: string[] = [];
  // packaging is on Material and Substance
  if (m.packaging !== undefined) attrs.push(`epd2:packaging="${m.packaging}"`);
  if ('renewable' in m && m.renewable !== undefined)
    attrs.push(`epd2:renewable="${m.renewable}"`);
  if ('recycled' in m && m.recycled !== undefined)
    attrs.push(`epd2:recycled="${m.recycled}"`);
  if ('recyclable' in m && m.recyclable !== undefined)
    attrs.push(`epd2:recyclable="${m.recyclable}"`);
  if ('ddGUID' in m && m.ddGUID) attrs.push(`epd2:ddGUID="${xmlEscape(m.ddGUID)}"`);
  if (m.CASNumber) attrs.push(`epd2:CASNumber="${xmlEscape(m.CASNumber)}"`);
  if (m.ECNumber) attrs.push(`epd2:ECNumber="${xmlEscape(m.ECNumber)}"`);
  if ('hazardCode' in m && m.hazardCode)
    attrs.push(`epd2:hazardCode="${xmlEscape(m.hazardCode)}"`);
  return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

function renderSubstance(s: Substance, indent: string): string {
  const attrs = renderSubstanceMaterialAttrs(s);
  const inner = indent + '  ';
  // Substance.name is a single string in the model (matches sample which has no xml:lang).
  const nameLine = `${inner}<epd2:name>${xmlEscape(s.name)}</epd2:name>`;
  const wpLine = renderRangeValue('epd2:weightPerc', s.weightPerc, inner);
  return `${indent}<epd2:substance${attrs}>\n${nameLine}\n${wpLine}\n${indent}</epd2:substance>`;
}

function renderMaterial(m: Material, indent: string): string {
  const attrs = renderSubstanceMaterialAttrs(m);
  const inner = indent + '  ';
  const nameLines = renderMultiLang('epd2:name', m.name, inner);
  const wpLine = renderRangeValue('epd2:weightPerc', m.weightPerc, inner);
  const massLine = renderRangeValue('epd2:mass', m.mass, inner);
  const subs = m.substances.map(s => renderSubstance(s, inner)).join('\n');

  const parts = [
    `${indent}<epd2:material${attrs}>`,
    nameLines,
    wpLine,
    massLine,
  ];
  if (subs) parts.push(subs);
  parts.push(`${indent}</epd2:material>`);
  return parts.join('\n');
}

function renderComponent(c: Component, indent: string): string {
  const inner = indent + '  ';
  // Component.name is a single string in the model.
  const nameLine = `${inner}<epd2:name>${xmlEscape(c.name)}</epd2:name>`;
  const wpLine = renderRangeValue('epd2:weightPerc', c.weightPerc, inner);
  const materials = c.materials.map(m => renderMaterial(m, inner)).join('\n');

  const parts = [
    `${indent}<epd2:component>`,
    nameLine,
    wpLine,
  ];
  if (materials) parts.push(materials);
  parts.push(`${indent}</epd2:component>`);
  return parts.join('\n');
}

function renderContentDeclaration(cd: ContentDeclaration, indent: string): string {
  const inner = indent + '  ';
  const parts = [`${indent}<epd2:contentDeclaration>`];
  for (const c of cd.components) parts.push(renderComponent(c, inner));
  for (const m of cd.materials) parts.push(renderMaterial(m, inner));
  for (const s of cd.substances) parts.push(renderSubstance(s, inner));
  parts.push(`${indent}</epd2:contentDeclaration>`);
  return parts.join('\n');
}

// ---- v1.3 (epd24:2024) helpers ----------------------------------------

function renderProductIds(productIds: ProductId[], indent: string): string {
  if (productIds.length === 0) return '';
  const inner = indent + '  ';
  const items = productIds.map(
    p =>
      `${inner}<epd24:productId epd24:type="${xmlEscape(p.type)}">${xmlEscape(p.value)}</epd24:productId>`,
  );
  return [`${indent}<epd24:productIds>`, ...items, `${indent}</epd24:productIds>`].join('\n');
}

function renderUseConditionFactor(f: UseConditionFactor, indent: string): string {
  const attrs =
    `epd24:factorCategory="${xmlEscape(f.factorCategory)}" ` +
    `epd24:objectSpecificGrade="${f.objectSpecificGrade}" ` +
    `epd24:referenceGrade="${f.referenceGrade}" ` +
    `epd24:factor="${f.factor}"`;

  if (!f.comments || f.comments.length === 0) {
    return `${indent}<epd24:useConditionFactor ${attrs}/>`;
  }
  const inner = indent + '  ';
  const commentLines = renderMultiLang('epd24:comment', f.comments, inner);
  return [
    `${indent}<epd24:useConditionFactor ${attrs}>`,
    commentLines,
    `${indent}</epd24:useConditionFactor>`,
  ].join('\n');
}

function renderServiceLife(
  tagName: 'epd24:referenceServiceLife' | 'epd24:estimatedServiceLife',
  sl: ServiceLife,
  indent: string,
): string {
  const inner = indent + '  ';
  const lines: string[] = [`${indent}<${tagName} epd24:years="${sl.years}">`];

  for (const f of sl.useConditionFactors) {
    lines.push(renderUseConditionFactor(f, inner));
  }

  if (sl.standardRef) {
    lines.push(renderReference('epd24:referenceToStandard', sl.standardRef, inner));
  }
  if (sl.useConditionsDocumentationRef) {
    lines.push(
      renderReference(
        'epd24:referenceToUseConditionsDocumentation',
        sl.useConditionsDocumentationRef,
        inner,
      ),
    );
  }
  if (sl.comments.length > 0) {
    lines.push(renderMultiLang('epd24:comment', sl.comments, inner));
  }

  lines.push(`${indent}</${tagName}>`);
  return lines.join('\n');
}

function renderEolScenarioData(scn: EolScenarioData, indent: string): string {
  const inner = indent + '  ';
  const lines: string[] = [
    `${indent}<epd24:eolScenarioData epd24:scenario="${xmlEscape(scn.scenario)}">`,
  ];

  if (scn.collection) {
    const c = scn.collection;
    const attrs: string[] = [];
    if (c.separate !== undefined) attrs.push(`epd24:separate="${c.separate}"`);
    if (c.withMixedWaste !== undefined)
      attrs.push(`epd24:withMixedWaste="${c.withMixedWaste}"`);
    if (attrs.length > 0)
      lines.push(`${inner}<epd24:collection ${attrs.join(' ')}/>`);
  }
  if (scn.recovery) {
    const r = scn.recovery;
    const attrs: string[] = [];
    if (r.reuse !== undefined) attrs.push(`epd24:reuse="${r.reuse}"`);
    if (r.recycling !== undefined) attrs.push(`epd24:recycling="${r.recycling}"`);
    if (r.energyRecovery !== undefined)
      attrs.push(`epd24:energyRecovery="${r.energyRecovery}"`);
    if (attrs.length > 0)
      lines.push(`${inner}<epd24:recovery ${attrs.join(' ')}/>`);
  }
  if (scn.disposal) {
    const d = scn.disposal;
    if (d.finalDeposition !== undefined)
      lines.push(
        `${inner}<epd24:disposal epd24:finalDeposition="${d.finalDeposition}"/>`,
      );
  }

  lines.push(`${indent}</epd24:eolScenarioData>`);
  return lines.join('\n');
}

function renderScenarioData(sd: ScenarioData, indent: string): string {
  const inner = indent + '  ';
  const innerInner = inner + '  ';
  const lines: string[] = [`${indent}<epd24:scenarioData>`];

  if (sd.useStageScenarioData && sd.useStageScenarioData.soilAndWaterImpactsDescription.length > 0) {
    const desc = renderMultiLang(
      'epd24:soilAndWaterImpactsDescription',
      sd.useStageScenarioData.soilAndWaterImpactsDescription,
      innerInner + '  ',
    );
    lines.push(
      `${inner}<epd24:useStageScenarioData>`,
      `${innerInner}<epd24:soilAndWaterImpacts>`,
      desc,
      `${innerInner}</epd24:soilAndWaterImpacts>`,
      `${inner}</epd24:useStageScenarioData>`,
    );
  }

  for (const eol of sd.eolScenarioData) {
    lines.push(renderEolScenarioData(eol, inner));
  }

  lines.push(`${indent}</epd24:scenarioData>`);
  return lines.join('\n');
}

function renderSite(s: Site, indent: string): string {
  const inner = indent + '  ';
  const lines: string[] = [`${indent}<epd24:site>`];
  lines.push(`${inner}<epd24:name>${xmlEscape(s.name)}</epd24:name>`);
  if (s.facilityIdentifier)
    lines.push(`${inner}<epd24:facilityIdentifier>${xmlEscape(s.facilityIdentifier)}</epd24:facilityIdentifier>`);
  if (s.olc) lines.push(`${inner}<epd24:olc>${xmlEscape(s.olc)}</epd24:olc>`);
  if (s.geoCode) lines.push(`${inner}<epd24:geoCode>${xmlEscape(s.geoCode)}</epd24:geoCode>`);
  if (s.streetAddress)
    lines.push(`${inner}<epd24:streetAddress>${xmlEscape(s.streetAddress)}</epd24:streetAddress>`);
  lines.push(`${indent}</epd24:site>`);
  return lines.join('\n');
}

function renderManufacturer(m: Manufacturer, indent: string): string {
  const inner = indent + '  ';
  const innerInner = inner + '  ';
  const isProvidingAttr = ` epd24:isProvidingData="${m.isProvidingData}"`;
  const lines: string[] = [`${indent}<epd24:manufacturer${isProvidingAttr}>`];

  lines.push(renderReference('epd24:contact', m.contact, inner));

  if (m.sites.length > 0) {
    lines.push(`${inner}<epd24:sites>`);
    for (const s of m.sites) lines.push(renderSite(s, innerInner));
    lines.push(`${inner}</epd24:sites>`);
  }

  lines.push(`${indent}</epd24:manufacturer>`);
  return lines.join('\n');
}

function renderManufacturers(mfrs: Manufacturer[], indent: string): string {
  if (mfrs.length === 0) return '';
  const inner = indent + '  ';
  const lines: string[] = [`${indent}<epd24:manufacturers>`];
  for (const m of mfrs) lines.push(renderManufacturer(m, inner));
  lines.push(`${indent}</epd24:manufacturers>`);
  return lines.join('\n');
}

function renderPcrCompliance(pcr: PCRCompliance, indent: string): string {
  return (
    `${indent}<epd24:pcrCompliance ` +
    `epd24:allocation="${pcr.allocation}" ` +
    `epd24:cutOffRules="${pcr.cutOffRules}" ` +
    `epd24:upstreamDataDeviatingFromAllocationPrinciples="${pcr.upstreamDataDeviatingFromAllocationPrinciples}"/>`
  );
}

// ---- Main generator ---------------------------------------------------

export function generateProcessXML(dataset: EPDDataset): string {
  const cfg = STANDARD_CONFIGS[dataset.meta.standardVersion];
  const features = cfg.features;
  const hasEpd2019 = cfg.namespaces.includes(NS.EPD_2019);
  const hasEpd2024 = cfg.namespaces.includes(NS.EPD_2024);

  const rootAttrs = buildRootAttributes(dataset);

  // ---- processInformation / dataSetInformation ----

  const nameParts = renderMultiLang('baseName', dataset.processInfo.name, '            ');

  const classEntries = dataset.processInfo.classification.entries
    .map(e => `              <class level="${e.level}">${xmlEscape(e.value)}</class>`)
    .join('\n');

  const classificationBlock = classEntries
    ? `          <classificationInformation>\n            <common:classification>\n${classEntries}\n            </common:classification>\n          </classificationInformation>`
    : '';

  const generalCommentBlock =
    dataset.processInfo.generalComment.length > 0
      ? renderMultiLang('common:generalComment', dataset.processInfo.generalComment, '          ')
      : '';

  // common:other in dataSetInformation
  const dsiOtherParts: string[] = [];
  const dsiIndent = '            ';

  if (
    features.productIds &&
    hasEpd2024 &&
    dataset.processInfo.productIds &&
    dataset.processInfo.productIds.length > 0
  ) {
    dsiOtherParts.push(renderProductIds(dataset.processInfo.productIds, dsiIndent));
  }

  if (features.serviceLife && hasEpd2024 && dataset.processInfo.serviceLife) {
    dsiOtherParts.push(
      renderServiceLife(
        'epd24:referenceServiceLife',
        dataset.processInfo.serviceLife,
        dsiIndent,
      ),
    );
  }

  if (features.serviceLife && hasEpd2024 && dataset.processInfo.estimatedServiceLife) {
    dsiOtherParts.push(
      renderServiceLife(
        'epd24:estimatedServiceLife',
        dataset.processInfo.estimatedServiceLife,
        dsiIndent,
      ),
    );
  }

  if (dataset.processInfo.scenarios.length > 0) {
    const scenXml = dataset.processInfo.scenarios
      .map(s => {
        const desc =
          s.description.length > 0
            ? `\n                <epd:description xml:lang="${xmlEscape(s.description[0].lang)}">${xmlEscape(s.description[0].value)}</epd:description>\n              `
            : '';
        return desc
          ? `              <epd:scenario epd:name="${xmlEscape(s.name)}" epd:group="${xmlEscape(s.group)}" epd:default="${s.default}">${desc}</epd:scenario>`
          : `              <epd:scenario epd:name="${xmlEscape(s.name)}" epd:group="${xmlEscape(s.group)}" epd:default="${s.default}"/>`;
      })
      .join('\n');
    dsiOtherParts.push(`            <epd:scenarios>\n${scenXml}\n            </epd:scenarios>`);
  }

  if (
    features.scenarioData &&
    hasEpd2024 &&
    dataset.processInfo.scenarioData
  ) {
    dsiOtherParts.push(
      renderScenarioData(dataset.processInfo.scenarioData, dsiIndent),
    );
  }

  if (dataset.processInfo.safetyMargins) {
    const sm = dataset.processInfo.safetyMargins;
    dsiOtherParts.push(
      `            <epd:safetyMargins>\n              <epd:margins>${sm.margins}</epd:margins>\n            </epd:safetyMargins>`,
    );
  }

  if (
    features.contentDeclaration &&
    hasEpd2019 &&
    dataset.processInfo.contentDeclaration
  ) {
    dsiOtherParts.push(
      renderContentDeclaration(dataset.processInfo.contentDeclaration, dsiIndent),
    );
  }

  if (features.svhc && hasEpd2024 && dataset.processInfo.svhc !== undefined) {
    dsiOtherParts.push(
      `${dsiIndent}<epd24:SVHC epd24:present="${dataset.processInfo.svhc.present}"/>`,
    );
  }

  const dsiCommonOther =
    dsiOtherParts.length > 0
      ? `          <common:other>\n${dsiOtherParts.join('\n')}\n          </common:other>`
      : '';

  // ---- time ----

  const publicationDate =
    dataset.processInfo.publicationDateOfEPD && hasEpd2019
      ? `      <epd2:publicationDateOfEPD>${xmlEscape(dataset.processInfo.publicationDateOfEPD)}</epd2:publicationDateOfEPD>`
      : '';

  // expirationDateOfEPD lives in the epd24 (2024) namespace per the v1.3 sample,
  // wrapped in a <common:other> inside <time>.
  const expirationDateBlock =
    dataset.processInfo.expirationDateOfEPD && hasEpd2024
      ? `      <common:other>\n        <epd24:expirationDateOfEPD>${xmlEscape(dataset.processInfo.expirationDateOfEPD)}</epd24:expirationDateOfEPD>\n      </common:other>`
      : '';

  // ---- technology ----

  const technologyDesc =
    dataset.processInfo.technologyDescription.length > 0
      ? renderMultiLang(
          'common:technologyDescriptionAndIncludedProcesses',
          dataset.processInfo.technologyDescription,
          '      ',
        )
      : '';

  const techApplicability =
    dataset.processInfo.technologicalApplicability.length > 0
      ? renderMultiLang(
          'common:technologicalApplicability',
          dataset.processInfo.technologicalApplicability,
          '      ',
        )
      : '';

  const flowDiagramRef = dataset.sources.technologyFlowDiagram
    ? renderReference(
        'referenceToTechnologyFlowDiagrammOrPicture',
        dataset.sources.technologyFlowDiagram,
        '      ',
      )
    : '';

  // ---- modellingAndValidation ----

  const pcrRef = dataset.sources.pcr
    ? renderReference('referenceToSupportedImpactAssessmentMethods', dataset.sources.pcr, '      ')
    : '';

  // Consolidated <common:other> for LCIMethodAndAllocation: subType (always),
  // variability and pcrCompliance (when applicable).
  const lciMethodOtherParts: string[] = [];
  const lciIndent = '        ';

  lciMethodOtherParts.push(
    `${lciIndent}<epd:subType>${xmlEscape(dataset.meta.subType)}</epd:subType>`,
  );

  if (features.variability && hasEpd2024 && dataset.processInfo.variability) {
    const v = dataset.processInfo.variability;
    const mfrRange = v.manufacturerVariability.variationRange
      ? ` epd24:variationRange="${xmlEscape(v.manufacturerVariability.variationRange)}"`
      : '';
    const prodRange = v.productVariability.variationRange
      ? ` epd24:variationRange="${xmlEscape(v.productVariability.variationRange)}"`
      : '';
    const inner = lciIndent + '  ';
    const descLines = v.description.length > 0
      ? '\n' + renderMultiLang('epd24:variabilityDescription', v.description, inner)
      : '';
    lciMethodOtherParts.push(
      `${lciIndent}<epd24:variability>\n` +
        `${inner}<epd24:manufacturerVariability epd24:type="${xmlEscape(v.manufacturerVariability.type)}" epd24:variation="${v.manufacturerVariability.variation}"${mfrRange}/>\n` +
        `${inner}<epd24:productVariability epd24:type="${xmlEscape(v.productVariability.type)}" epd24:variation="${v.productVariability.variation}"${prodRange}/>` +
        descLines + `\n` +
        `${lciIndent}</epd24:variability>`,
    );
  }

  if (hasEpd2024 && dataset.processInfo.pcrCompliance) {
    lciMethodOtherParts.push(
      renderPcrCompliance(dataset.processInfo.pcrCompliance, lciIndent),
    );
  }

  const lciMethodCommonOther =
    `      <common:other>\n${lciMethodOtherParts.join('\n')}\n      </common:other>`;

  const bgDbRefs = dataset.sources.backgroundDatabases
    .map(ref => renderReference('referenceToDataSource', ref, '      '))
    .join('\n');

  // Consolidated <common:other> for dataSourcesTreatmentAndRepresentativeness:
  // manufacturers (epd24, when applicable) + referenceToOriginalEPD (epd2),
  // per the v1.3 sample (sample_data/processes/EPDv1.3_example_*.xml lines 221-227).
  const dstrOtherParts: string[] = [];
  const dstrIndent = '        ';

  if (
    features.manufacturers &&
    hasEpd2024 &&
    dataset.organisations.manufacturers.length > 0
  ) {
    dstrOtherParts.push(
      renderManufacturers(dataset.organisations.manufacturers, dstrIndent),
    );
  }

  if (hasEpd2019 && dataset.publicationAndOwnership.referenceToOriginalEPD) {
    dstrOtherParts.push(
      renderReference(
        'epd2:referenceToOriginalEPD',
        dataset.publicationAndOwnership.referenceToOriginalEPD,
        dstrIndent,
      ),
    );
  }

  const dstrCommonOther =
    dstrOtherParts.length > 0
      ? `      <common:other>\n${dstrOtherParts.join('\n')}\n      </common:other>`
      : '';

  const verifierBlock = dataset.organisations.verifier
    ? renderReference(
        'referenceToNameOfReviewerAndInstitution',
        dataset.organisations.verifier,
        '        ',
      )
    : '';

  // Standard compliance declaration (always included)
  const stdComplianceRef = cfg.complianceRef;
  const stdCompliance =
    `      <compliance>\n` +
    `        <referenceToComplianceSystem type="source data set" refObjectId="${stdComplianceRef.uuid}">\n` +
    `          <common:shortDescription xml:lang="en">${xmlEscape(stdComplianceRef.name)}</common:shortDescription>\n` +
    `        </referenceToComplianceSystem>\n` +
    `        <common:approvalOfOverallCompliance>Fully compliant</common:approvalOfOverallCompliance>\n` +
    `      </compliance>`;

  const additionalCompliance = dataset.complianceDeclarations
    .map(c => {
      const sysRef = renderReference('referenceToComplianceSystem', c.system, '        ');
      const overall = c.overallCompliance
        ? `        <common:approvalOfOverallCompliance>${xmlEscape(c.overallCompliance)}</common:approvalOfOverallCompliance>`
        : '';
      return `      <compliance>\n${sysRef}${overall ? '\n' + overall : ''}\n      </compliance>`;
    })
    .join('\n');

  // ---- administrativeInformation ----

  const commissionerRef = dataset.organisations.commissioner
    ? renderReference(
        'common:referenceToCommissioner',
        dataset.organisations.commissioner,
        '      ',
      )
    : '';

  const dataGeneratorRef = dataset.organisations.dataGenerator
    ? renderReference(
        'common:referenceToDataSetGenerator',
        dataset.organisations.dataGenerator,
        '      ',
      )
    : '';

  const dataSetFormatRefs = dataset.dataEntryBy.referenceToDataSetFormat
    .map(ref => renderReference('common:referenceToDataSetFormat', ref, '      '))
    .join('\n');

  const ownerRef = dataset.publicationAndOwnership.referenceToOwner
    ? renderReference(
        'common:referenceToOwnershipOfDataSet',
        dataset.publicationAndOwnership.referenceToOwner,
        '      ',
      )
    : '';

  // referenceToPublisher lives inside <publicationAndOwnership>/<common:other>
  // as <epd2:referenceToPublisher> per the v1.3 sample (lines 286-291).
  const pubAndOwnerCommonOther =
    hasEpd2019 && dataset.publicationAndOwnership.referenceToPublisher
      ? `      <common:other>\n${renderReference(
          'epd2:referenceToPublisher',
          dataset.publicationAndOwnership.referenceToPublisher,
          '        ',
        )}\n      </common:other>`
      : '';

  const registryAuthorityRef = dataset.publicationAndOwnership.registrationAuthority
    ? renderReference(
        'common:referenceToRegistrationAuthority',
        dataset.publicationAndOwnership.registrationAuthority,
        '      ',
      )
    : '';

  // ---- exchanges ----

  const refFlowID = dataset.quantitativeReference.referenceToReferenceFlow;
  const refExchangeXml = renderReferenceExchange(refFlowID);

  const exchangesXml = dataset.exchanges.map(ex => renderExchange(ex)).join('\n');

  // ---- LCIAResults ----

  const lciaXml = dataset.lciaResults.map(r => renderLCIAResult(r)).join('\n');

  // ---- Assemble ----

  const sections: string[] = [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<processDataSet ${rootAttrs}`,
    `  version="1.1">`,

    `  <processInformation>`,
    `    <dataSetInformation>`,
    `      <common:UUID>${xmlEscape(dataset.meta.uuid)}</common:UUID>`,
    `      <name>`,
    nameParts,
    `      </name>`,
    opt(classificationBlock),
    opt(generalCommentBlock),
    opt(dsiCommonOther),
    `    </dataSetInformation>`,
    `    <quantitativeReference type="Reference flow(s)">`,
    `      <referenceToReferenceFlow>${refFlowID}</referenceToReferenceFlow>`,
    `    </quantitativeReference>`,
    `    <time>`,
    `      <common:referenceYear>${dataset.processInfo.referenceYear}</common:referenceYear>`,
    `      <common:dataSetValidUntil>${dataset.processInfo.validUntil}</common:dataSetValidUntil>`,
    opt(publicationDate),
    opt(expirationDateBlock),
    `    </time>`,
    `    <geography>`,
    `      <locationOfOperationSupplyOrProduction location="${xmlEscape(dataset.processInfo.location)}"/>`,
    `    </geography>`,
    `    <technology>`,
    opt(technologyDesc),
    opt(techApplicability),
    opt(flowDiagramRef),
    `    </technology>`,
    `  </processInformation>`,

    `  <modellingAndValidation>`,
    `    <LCIMethodAndAllocation>`,
    `      <typeOfDataSet>EPD</typeOfDataSet>`,
    opt(pcrRef),
    lciMethodCommonOther,
    `    </LCIMethodAndAllocation>`,
    `    <dataSourcesTreatmentAndRepresentativeness>`,
    opt(bgDbRefs),
    opt(dstrCommonOther),
    `    </dataSourcesTreatmentAndRepresentativeness>`,
    `    <validation>`,
    `      <review>`,
    opt(verifierBlock),
    `      </review>`,
    `    </validation>`,
    `    <complianceDeclarations>`,
    stdCompliance,
    opt(additionalCompliance),
    `    </complianceDeclarations>`,
    `  </modellingAndValidation>`,

    `  <administrativeInformation>`,
    `    <commissionerAndGoal>`,
    opt(commissionerRef),
    `    </commissionerAndGoal>`,
    `    <dataGenerator>`,
    opt(dataGeneratorRef),
    `    </dataGenerator>`,
    `    <dataEntryBy>`,
    `      <common:timeStamp>${xmlEscape(dataset.dataEntryBy.timestamp)}</common:timeStamp>`,
    opt(dataSetFormatRefs),
    `    </dataEntryBy>`,
    `    <publicationAndOwnership>`,
    `      <common:dataSetVersion>${xmlEscape(dataset.publicationAndOwnership.dataSetVersion)}</common:dataSetVersion>`,
    `      <common:dateOfLastRevision>${xmlEscape(dataset.publicationAndOwnership.dateOfLastRevision)}</common:dateOfLastRevision>`,
    opt(registryAuthorityRef),
    opt(ownerRef),
    `      <common:copyright>${dataset.publicationAndOwnership.copyright}</common:copyright>`,
    opt(pubAndOwnerCommonOther),
    `    </publicationAndOwnership>`,
    `  </administrativeInformation>`,

    `  <exchanges>`,
    refExchangeXml,
    opt(exchangesXml),
    `  </exchanges>`,

    lciaXml ? `  <LCIAResults>\n${lciaXml}\n  </LCIAResults>` : '',

    `</processDataSet>`,
  ];

  return sections.filter(l => l !== '').join('\n');
}
