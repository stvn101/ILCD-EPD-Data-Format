import type { MultiLangString, Reference, StandardVersion, EPDSubType, ModuleName } from '../schema/types';
import { v4 as uuidv4 } from 'uuid';

// --- Sub-types ---

export interface Scenario {
  name: string;
  group: string;
  default: boolean;
  description: MultiLangString[];
}

export interface SafetyMargins {
  margins: number;
  description: MultiLangString[];
}

export interface Variability {
  manufacturerVariability: { type: string; variation: number; variationRange?: string };
  productVariability: { type: string; variation: number; variationRange?: string };
  description: MultiLangString[];
}

export interface RangeValue {
  value?: number;
  lowerValue?: number;
  upperValue?: number;
}

export interface Substance {
  name: string;
  weightPerc: RangeValue;
  CASNumber?: string;
  ECNumber?: string;
  hazardCode?: string;
  packaging?: boolean;
}

export interface Material {
  name: MultiLangString[];
  weightPerc: RangeValue;
  mass: RangeValue;
  CASNumber?: string;
  ECNumber?: string;
  ddGUID?: string;
  renewable?: number;
  recycled?: number;
  recyclable?: number;
  packaging?: boolean;
  substances: Substance[];
}

export interface Component {
  name: string;
  weightPerc: RangeValue;
  materials: Material[];
}

export interface ContentDeclaration {
  components: Component[];
  materials: Material[];
  substances: Substance[];
}

export type MatMLPropertyName =
  | 'gross density'
  | 'bulk density'
  | 'grammage'
  | 'layer thickness'
  | 'productiveness'
  | 'linear density'
  | 'conversion factor to 1 kg';

export interface MatMLProperty {
  propertyName: MatMLPropertyName;
  value: number;
  materialName: string;
}

export interface Site {
  name: string;
  facilityIdentifier?: string;
  olc?: string;
  geoCode?: string;
  streetAddress?: string;
}

export interface Manufacturer {
  contact: Reference;
  isProvidingData: boolean;
  sites: Site[];
}

export interface ClassEntry {
  level: number;
  value: string;
}

export interface ComplianceRef {
  system: Reference;
  overallCompliance?: string;
}

export interface Exchange {
  dataSetInternalID: number;
  flowRef: Reference;
  exchangeDirection: 'Input' | 'Output';
  meanAmount: number;
  amounts: Array<{ module: ModuleName; scenario?: string; value: number }>;
  unitGroupRef: Reference;
}

export interface LCIAResult {
  methodRef: Reference;
  meanAmount: number;
  amounts: Array<{ module: ModuleName; scenario?: string; value: number }>;
  unitGroupRef: Reference;
}

// --- Main Dataset ---

export interface EPDDataset {
  meta: {
    standardVersion: StandardVersion;
    subType: EPDSubType;
    uuid: string;
    dataSetVersion: string;
    epdVersion: string;
  };

  processInfo: {
    name: MultiLangString[];
    classification: { classesFile: string; entries: ClassEntry[] };
    generalComment: MultiLangString[];
    referenceYear: number;
    validUntil: number;
    publicationDateOfEPD?: string;
    expirationDateOfEPD?: string;
    location: string;
    locationDescription: MultiLangString[];
    technologyDescription: MultiLangString[];
    technologicalApplicability: MultiLangString[];
    serviceLife?: {
      years: number;
      standardRef: Reference;
      comment: MultiLangString[];
    };
    scenarios: Scenario[];
    safetyMargins?: SafetyMargins;
    variability?: Variability;
    svhc?: { present: boolean };
    contentDeclaration?: ContentDeclaration;
  };

  productFlow: {
    uuid: string;
    name: MultiLangString[];
    declaredUnit: {
      flowPropertyRef: Reference;
      unitGroupRef: Reference;
    };
    isA: Reference | null;
    materialProperties: MatMLProperty[];
  };

  quantitativeReference: {
    referenceToReferenceFlow: number;
  };

  exchanges: Exchange[];
  lciaResults: LCIAResult[];

  organisations: {
    manufacturers: Manufacturer[];
    commissioner: Reference | null;
    dataGenerator: Reference | null;
    programmeOperator: Reference | null;
    verifier: Reference | null;
    ownerOfDataSet: Reference | null;
  };

  complianceDeclarations: ComplianceRef[];

  dataEntryBy: {
    timestamp: string;
    referenceToDataSetFormat: Reference[];
  };

  publicationAndOwnership: {
    dataSetVersion: string;
    dateOfLastRevision: string;
    registrationAuthority: Reference | null;
    registrationNumber: string;
    referenceToOwner: Reference | null;
    copyright: boolean;
    licenseType: string;
    referenceToPublisher: Reference | null;
    referenceToOriginalEPD: Reference | null;
  };

  sources: {
    pcr: Reference | null;
    backgroundDatabases: Reference[];
    epdDocument: Reference | null;
    dataHandlingPrinciples: Reference | null;
    technologyPicture: Reference | null;
    technologyFlowDiagram: Reference | null;
    additionalSources: Reference[];
  };

  declaredModules: Set<ModuleName>;
}

export function createEmptyDataset(standardVersion: StandardVersion = '+A2/EF3.1'): EPDDataset {
  const now = new Date().toISOString();
  return {
    meta: {
      standardVersion,
      subType: 'specific dataset',
      uuid: uuidv4(),
      dataSetVersion: '00.01.000',
      epdVersion: '1.3',
    },
    processInfo: {
      name: [{ lang: 'en', value: '' }],
      classification: { classesFile: '', entries: [] },
      generalComment: [],
      referenceYear: new Date().getFullYear(),
      validUntil: new Date().getFullYear() + 5,
      location: '',
      locationDescription: [],
      technologyDescription: [],
      technologicalApplicability: [],
      scenarios: [],
    },
    productFlow: {
      uuid: uuidv4(),
      name: [{ lang: 'en', value: '' }],
      declaredUnit: {
        flowPropertyRef: { type: 'flow property data set', refObjectId: '', shortDescription: [] },
        unitGroupRef: { type: 'unit group data set', refObjectId: '', shortDescription: [] },
      },
      isA: null,
      materialProperties: [],
    },
    quantitativeReference: { referenceToReferenceFlow: 0 },
    exchanges: [],
    lciaResults: [],
    organisations: {
      manufacturers: [],
      commissioner: null,
      dataGenerator: null,
      programmeOperator: null,
      verifier: null,
      ownerOfDataSet: null,
    },
    complianceDeclarations: [],
    dataEntryBy: {
      timestamp: now,
      referenceToDataSetFormat: [],
    },
    publicationAndOwnership: {
      dataSetVersion: '00.01.000',
      dateOfLastRevision: now,
      registrationAuthority: null,
      registrationNumber: '',
      referenceToOwner: null,
      copyright: true,
      licenseType: 'Free of charge for all users and uses',
      referenceToPublisher: null,
      referenceToOriginalEPD: null,
    },
    sources: {
      pcr: null,
      backgroundDatabases: [],
      epdDocument: null,
      dataHandlingPrinciples: null,
      technologyPicture: null,
      technologyFlowDiagram: null,
      additionalSources: [],
    },
    declaredModules: new Set(),
  };
}
