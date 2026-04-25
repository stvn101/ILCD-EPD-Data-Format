export type StandardVersion = '+A1' | '+A2/EF3.0' | '+A2/EF3.1';
export type IndicatorCategory = 'exchange' | 'lcia';

export interface Indicator {
  uuid: string;
  version: string;
  nameEn: string;
  unitEn: string;
  unitGroupUuid: string;
  nameDe: string;
  unitDe: string;
  category: IndicatorCategory;
}

export interface IndicatorSet {
  standardVersion: StandardVersion;
  exchanges: Indicator[];
  lcia: Indicator[];
  all: Indicator[];
}

export interface CountryIndicator extends Indicator {
  countries: string[];
}

export type ModuleName =
  | 'A1' | 'A2' | 'A3' | 'A1-A3'
  | 'A4' | 'A5'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'D';

export type EPDSubType =
  | 'specific dataset'
  | 'average dataset'
  | 'representative dataset'
  | 'generic dataset'
  | 'template dataset';

export interface MultiLangString {
  lang: string;
  value: string;
}

export interface Reference {
  type: string;
  refObjectId: string;
  version?: string;
  uri?: string;
  shortDescription: MultiLangString[];
}

export interface CommonReference {
  name: string;
  datasetType: string;
  uuid: string;
  version: string;
}

export interface FlowProperty {
  flowProperty: string;
  datasetType: string;
  flowPropertyUuid: string;
  version: string;
  referenceUnit: string;
  referenceUnitGroup: string;
  referenceUnitGroupDatasetType: string;
  referenceUnitGroupUuid: string;
  versionUnitGroup: string;
}

export type BackgroundDbProvider = 'GaBi' | 'ecoinvent' | 'AusLCI';

export interface BackgroundDatabase {
  provider: BackgroundDbProvider;
  databaseVersion: string;
  name: string;
  uuid: string;
}
