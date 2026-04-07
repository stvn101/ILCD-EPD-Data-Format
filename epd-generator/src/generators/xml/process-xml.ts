import type { EPDDataset, Exchange, LCIAResult } from '../../model/epd-dataset';
import type { Reference } from '../../schema/types';
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

  if (features.serviceLife && dataset.processInfo.serviceLife) {
    const sl = dataset.processInfo.serviceLife;
    dsiOtherParts.push(
      `            <epd24:serviceLife>\n              <epd24:years>${sl.years}</epd24:years>\n            </epd24:serviceLife>`,
    );
  }

  if (features.scenarioData && dataset.processInfo.scenarios.length > 0) {
    const scenXml = dataset.processInfo.scenarios
      .map(s => {
        const desc =
          s.description.length > 0
            ? `\n                <epd2:description xml:lang="${xmlEscape(s.description[0].lang)}">${xmlEscape(s.description[0].value)}</epd2:description>\n              `
            : '';
        return desc
          ? `              <epd2:scenario epd2:name="${xmlEscape(s.name)}" epd2:group="${xmlEscape(s.group)}" epd2:default="${s.default}">${desc}</epd2:scenario>`
          : `              <epd2:scenario epd2:name="${xmlEscape(s.name)}" epd2:group="${xmlEscape(s.group)}" epd2:default="${s.default}"/>`;
      })
      .join('\n');
    dsiOtherParts.push(`            <epd2:scenarios>\n${scenXml}\n            </epd2:scenarios>`);
  }

  if (dataset.processInfo.safetyMargins) {
    const sm = dataset.processInfo.safetyMargins;
    dsiOtherParts.push(
      `            <epd2:safetyMargins>\n              <epd2:margins>${sm.margins}</epd2:margins>\n            </epd2:safetyMargins>`,
    );
  }

  if (features.svhc && dataset.processInfo.svhc !== undefined) {
    dsiOtherParts.push(
      `            <epd24:svhc epd24:present="${dataset.processInfo.svhc.present}"/>`,
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

  const expirationDate =
    dataset.processInfo.expirationDateOfEPD && hasEpd2019
      ? `      <epd2:expirationDateOfEPD>${xmlEscape(dataset.processInfo.expirationDateOfEPD)}</epd2:expirationDateOfEPD>`
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

  const subTypeElem = `      <common:other>\n        <epd:subType>${xmlEscape(dataset.meta.subType)}</epd:subType>\n      </common:other>`;

  const variabilityBlock =
    features.variability && dataset.processInfo.variability
      ? (() => {
          const v = dataset.processInfo.variability;
          return (
            `      <common:other>\n        <epd2:variability>\n` +
            `          <epd2:manufacturerVariability epd2:type="${xmlEscape(v.manufacturerVariability.type)}" epd2:variation="${v.manufacturerVariability.variation}"/>\n` +
            `          <epd2:productVariability epd2:type="${xmlEscape(v.productVariability.type)}" epd2:variation="${v.productVariability.variation}"/>\n` +
            `        </epd2:variability>\n      </common:other>`
          );
        })()
      : '';

  const bgDbRefs = dataset.sources.backgroundDatabases
    .map(ref => renderReference('referenceToDataSource', ref, '      '))
    .join('\n');

  const manufacturersBlock =
    features.manufacturers && dataset.organisations.manufacturers.length > 0 && hasEpd2024
      ? (() => {
          const mfrs = dataset.organisations.manufacturers
            .map(m => {
              const contactRef = renderReference(
                'epd24:referenceToManufacturer',
                m.contact,
                '          ',
              );
              return `        <epd24:manufacturer>\n${contactRef}\n        </epd24:manufacturer>`;
            })
            .join('\n');
          return `      <common:other>\n        <epd24:manufacturers>\n${mfrs}\n        </epd24:manufacturers>\n      </common:other>`;
        })()
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

  const publisherRef = dataset.publicationAndOwnership.referenceToPublisher
    ? renderReference(
        'common:referenceToUnchangedRepublication',
        dataset.publicationAndOwnership.referenceToPublisher,
        '      ',
      )
    : '';

  const originalEPDRef =
    dataset.publicationAndOwnership.referenceToOriginalEPD && hasEpd2019
      ? renderReference(
          'epd2:referenceToOriginalEPD',
          dataset.publicationAndOwnership.referenceToOriginalEPD,
          '      ',
        )
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
    opt(expirationDate),
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
    subTypeElem,
    opt(variabilityBlock),
    `    </LCIMethodAndAllocation>`,
    `    <dataSourcesTreatmentAndRepresentativeness>`,
    opt(bgDbRefs),
    opt(manufacturersBlock),
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
    opt(publisherRef),
    opt(originalEPDRef),
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
