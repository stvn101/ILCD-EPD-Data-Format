import type { StandardVersion, ModuleName, EPDSubType } from './types';
import { NS } from './namespaces';

export interface StandardFeatures {
  contentDeclaration: boolean;
  serviceLife: boolean;
  svhc: boolean;
  variability: boolean;
  manufacturers: boolean;
  productIds: boolean;
  scenarioData: boolean;
}

export interface ComplianceRef {
  uuid: string;
  name: string;
}

export interface DataFormatRef {
  uuid: string;
  name: string;
}

export interface StandardConfig {
  version: StandardVersion;
  label: string;
  indicatorCsvFile: string;
  namespaces: string[];
  features: StandardFeatures;
  complianceRef: ComplianceRef;
  dataFormatRefs: DataFormatRef[];
}

export const STANDARD_CONFIGS: Record<StandardVersion, StandardConfig> = {
  '+A1': {
    version: '+A1',
    label: 'EN 15804+A1',
    indicatorCsvFile: 'EN15804+A1_indicators.csv',
    namespaces: [NS.EPD_2013],
    features: {
      contentDeclaration: false,
      serviceLife: false,
      svhc: false,
      variability: false,
      manufacturers: false,
      productIds: false,
      scenarioData: false,
    },
    complianceRef: {
      uuid: 'b00f9ec0-7874-11e3-981f-0800200c9a66',
      name: 'EN 15804+A1',
    },
    dataFormatRefs: [
      { uuid: 'a97a0155-0234-4b87-b4ce-a45da52f2a40', name: 'ILCD Format' },
      { uuid: 'cba73800-7874-11e3-981f-0800200c9a66', name: 'EPD Data Format Extensions v1.1' },
    ],
  },

  '+A2/EF3.0': {
    version: '+A2/EF3.0',
    label: 'EN 15804+A2 (EF 3.0)',
    indicatorCsvFile: 'EN15804+A2_EF3.0_indicators.csv',
    namespaces: [NS.EPD_2013, NS.EPD_2019],
    features: {
      contentDeclaration: true,
      serviceLife: false,
      svhc: false,
      variability: true,
      manufacturers: false,
      productIds: false,
      scenarioData: false,
    },
    complianceRef: {
      uuid: 'c0016b33-8cf7-415c-ac6e-deba0d21440d',
      name: 'EN 15804+A2 (EF 3.0)',
    },
    dataFormatRefs: [
      { uuid: 'a97a0155-0234-4b87-b4ce-a45da52f2a40', name: 'ILCD Format' },
      { uuid: 'cba73800-7874-11e3-981f-0800200c9a66', name: 'EPD Data Format Extensions v1.1' },
      { uuid: 'a29449fd-aa2f-4de8-b5d7-4b06b43c6fde', name: 'EPD Data Format Extensions v1.2' },
    ],
  },

  '+A2/EF3.1': {
    version: '+A2/EF3.1',
    label: 'EN 15804+A2 (EF 3.1)',
    indicatorCsvFile: 'EN15804+A2_EF3.1_indicators.csv',
    namespaces: [NS.EPD_2013, NS.EPD_2019, NS.EPD_2024],
    features: {
      contentDeclaration: true,
      serviceLife: true,
      svhc: true,
      variability: true,
      manufacturers: true,
      productIds: true,
      scenarioData: true,
    },
    complianceRef: {
      uuid: 'd4aa3ec7-b1d7-4a4a-a6cb-37af88dcc902',
      name: 'EN 15804+A2 (EF 3.1)',
    },
    dataFormatRefs: [
      { uuid: 'a97a0155-0234-4b87-b4ce-a45da52f2a40', name: 'ILCD Format' },
      { uuid: 'cba73800-7874-11e3-981f-0800200c9a66', name: 'EPD Data Format Extensions v1.1' },
      { uuid: 'a29449fd-aa2f-4de8-b5d7-4b06b43c6fde', name: 'EPD Data Format Extensions v1.2' },
    ],
  },
};

export const ALL_MODULES: ModuleName[] = [
  'A1', 'A2', 'A3', 'A1-A3',
  'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
  'C1', 'C2', 'C3', 'C4',
  'D',
];

export const EPD_SUB_TYPES: EPDSubType[] = [
  'specific dataset',
  'average dataset',
  'representative dataset',
  'generic dataset',
  'template dataset',
];
