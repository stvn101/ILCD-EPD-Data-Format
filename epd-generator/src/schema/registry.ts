import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { StandardVersion, IndicatorSet, CommonReference, FlowProperty, CountryIndicator } from './types';
import { STANDARD_CONFIGS } from './standard-configs';
import type { StandardConfig } from './standard-configs';
import {
  parseIndicatorCSV,
  parseCommonReferencesCSV,
  parseFlowPropertiesCSV,
  parseCountryIndicatorCSV,
} from './indicator-parser';

// __dirname = epd-generator/src/schema
// Going up 3 levels lands at the top-level ILCD-EPD-Data-Format-release-v1.3 directory.
// The reference CSVs are inside the nested ILCD-EPD-Data-Format-release-v1.3 sub-folder.
const IDENTIFIERS_DIR = resolve(
  __dirname,
  '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers'
);

export class SchemaRegistry {
  private indicatorSets: Map<StandardVersion, IndicatorSet>;
  private commonReferences: CommonReference[];
  private flowProperties: FlowProperty[];
  private countryIndicators: CountryIndicator[];

  private constructor(
    indicatorSets: Map<StandardVersion, IndicatorSet>,
    commonReferences: CommonReference[],
    flowProperties: FlowProperty[],
    countryIndicators: CountryIndicator[]
  ) {
    this.indicatorSets = indicatorSets;
    this.commonReferences = commonReferences;
    this.flowProperties = flowProperties;
    this.countryIndicators = countryIndicators;
  }

  /**
   * Factory method that reads all CSVs from the identifiers directory using Node fs.
   */
  static create(): SchemaRegistry {
    function readCSV(filename: string): string {
      return readFileSync(resolve(IDENTIFIERS_DIR, filename), 'utf-8');
    }

    const indicatorSets = new Map<StandardVersion, IndicatorSet>();
    for (const [version, config] of Object.entries(STANDARD_CONFIGS) as [StandardVersion, StandardConfig][]) {
      const csv = readCSV(config.indicatorCsvFile);
      indicatorSets.set(version, parseIndicatorCSV(csv, version));
    }

    const commonReferences = parseCommonReferencesCSV(readCSV('Common_references.csv'));
    const flowProperties = parseFlowPropertiesCSV(readCSV('Flow_properties_and_unit_groups.csv'));
    const countryIndicators = parseCountryIndicatorCSV(readCSV('Country-specific_indicators.csv'));

    return new SchemaRegistry(indicatorSets, commonReferences, flowProperties, countryIndicators);
  }

  getIndicatorSet(version: StandardVersion): IndicatorSet {
    const set = this.indicatorSets.get(version);
    if (!set) {
      throw new Error(`No indicator set found for version: ${version}`);
    }
    return set;
  }

  getConfig(version: StandardVersion): StandardConfig {
    return STANDARD_CONFIGS[version];
  }

  getCommonReferences(): CommonReference[] {
    return this.commonReferences;
  }

  getFlowProperties(): FlowProperty[] {
    return this.flowProperties;
  }

  getCountryIndicators(): CountryIndicator[] {
    return this.countryIndicators;
  }

  getCountryIndicatorsFor(country: string): CountryIndicator[] {
    return this.countryIndicators.filter((indicator) =>
      indicator.countries.some((c) => c.toLowerCase() === country.toLowerCase())
    );
  }

  getAvailableCountries(): string[] {
    const countrySet = new Set<string>();
    for (const indicator of this.countryIndicators) {
      for (const country of indicator.countries) {
        countrySet.add(country);
      }
    }
    return Array.from(countrySet).sort();
  }
}
