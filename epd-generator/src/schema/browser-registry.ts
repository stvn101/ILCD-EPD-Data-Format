// Browser-side CSV registry. Uses Vite ?raw imports so the identifier CSVs
// are bundled at build time. Only import this file from React components,
// never from anything that needs to run in vitest's Node context.
import type { StandardVersion, Indicator } from './types';
import {
  parseIndicatorCSV,
  parseCommonReferencesCSV,
  parseFlowPropertiesCSV,
  parseBackgroundDbCSV,
  parseCountryIndicatorCSV,
} from './indicator-parser';
import { buildAuthoritativeUuids } from '../validation/authoritative-uuids';

import a1CSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A1_indicators.csv?raw';
import a2ef30CSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A2_EF3.0_indicators.csv?raw';
import a2ef31CSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/EN15804+A2_EF3.1_indicators.csv?raw';
import countryCSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Country-specific_indicators.csv?raw';
import commonRefsCSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Common_references.csv?raw';
import flowPropsCSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/Flow_properties_and_unit_groups.csv?raw';
import gabiCSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/BackgroundDB_SourceDatasets_GaBi.csv?raw';
import ecoinventCSV from '../../../ILCD-EPD-Data-Format-release-v1.3/doc/identifiers/BackgroundDB_SourceDatasets_ecoinvent.csv?raw';

function pickIndicatorCSV(version: StandardVersion): string {
  if (version === '+A1') return a1CSV;
  if (version === '+A2/EF3.0') return a2ef30CSV;
  return a2ef31CSV;
}

export function loadAuthoritativeUuids(version: StandardVersion): Set<string> {
  const indicators = parseIndicatorCSV(pickIndicatorCSV(version), version);
  return buildAuthoritativeUuids({
    commonReferences: parseCommonReferencesCSV(commonRefsCSV),
    flowProperties: parseFlowPropertiesCSV(flowPropsCSV),
    backgroundDatabases: [
      ...parseBackgroundDbCSV(gabiCSV, 'GaBi'),
      ...parseBackgroundDbCSV(ecoinventCSV, 'ecoinvent'),
    ],
    indicators: indicators.all,
    countryIndicators: parseCountryIndicatorCSV(countryCSV),
  });
}

export function loadLciaIndicators(version: StandardVersion): Indicator[] {
  return parseIndicatorCSV(pickIndicatorCSV(version), version).lcia;
}
