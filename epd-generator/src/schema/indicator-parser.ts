import type {
  StandardVersion,
  Indicator,
  IndicatorCategory,
  IndicatorSet,
  CountryIndicator,
  CommonReference,
  FlowProperty,
  BackgroundDatabase,
  BackgroundDbProvider,
} from './types';

/**
 * Parse a single CSV line handling quoted fields (fields may contain commas).
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Returns true if a row is a blank-UUID separator row
 * (i.e. first column is empty or all-blank UUID).
 */
function isSeparatorRow(fields: string[]): boolean {
  return fields[0].trim() === '';
}

/**
 * Returns true if a row is a metadata/annotation row like "updated", "new".
 * These appear at the bottom after blank rows.
 */
function isMetadataRow(fields: string[]): boolean {
  const first = fields[0].trim().toLowerCase();
  return first === 'updated' || first === 'new';
}

/**
 * Parse indicator rows for +A1 format.
 * Columns: UUID, Name (en), Unit (en), UnitGroup UUID, de, Einheit (de)
 */
function parseA1Row(fields: string[], category: IndicatorCategory): Indicator {
  return {
    uuid: fields[0].trim(),
    version: '',
    nameEn: fields[1].trim(),
    unitEn: fields[2].trim(),
    unitGroupUuid: fields[3].trim(),
    nameDe: fields[4].trim(),
    unitDe: fields[5].trim(),
    category,
  };
}

/**
 * Parse indicator rows for +A2 format.
 * Columns: UUID, Version, Name (en), Unit (en), UnitGroup UUID, Name (de), Einheit (de)
 */
function parseA2Row(fields: string[], category: IndicatorCategory): Indicator {
  return {
    uuid: fields[0].trim(),
    version: fields[1].trim(),
    nameEn: fields[2].trim(),
    unitEn: fields[3].trim(),
    unitGroupUuid: fields[4].trim(),
    nameDe: fields[5].trim(),
    unitDe: fields[6].trim(),
    category,
  };
}

/**
 * Parse an indicator CSV file (EN15804+A1, +A2/EF3.0, +A2/EF3.1).
 *
 * Structure:
 * - Header row (skipped)
 * - Exchange indicator rows (top section)
 * - Blank-UUID separator row(s)
 * - LCIA indicator rows (bottom section)
 * - Possibly more blank rows and metadata rows (skipped)
 */
export function parseIndicatorCSV(csv: string, standardVersion: StandardVersion): IndicatorSet {
  const lines = csv.split(/\r?\n/);
  const isA1 = standardVersion === '+A1';

  const exchanges: Indicator[] = [];
  const lcia: Indicator[] = [];

  let passedSeparator = false;
  let headerSkipped = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);

    // Skip header row
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    // Skip metadata annotation rows (e.g. "updated", "new")
    if (isMetadataRow(fields)) continue;

    // Blank UUID row acts as section separator
    if (isSeparatorRow(fields)) {
      if (!passedSeparator) {
        passedSeparator = true;
      }
      continue;
    }

    // Must have a valid UUID in first column
    const uuid = fields[0].trim();
    if (!uuid || uuid.length < 30) continue;

    if (!passedSeparator) {
      exchanges.push(isA1 ? parseA1Row(fields, 'exchange') : parseA2Row(fields, 'exchange'));
    } else {
      lcia.push(isA1 ? parseA1Row(fields, 'lcia') : parseA2Row(fields, 'lcia'));
    }
  }

  return {
    standardVersion,
    exchanges,
    lcia,
    all: [...exchanges, ...lcia],
  };
}

/**
 * Parse Country-specific_indicators.csv.
 * Columns: UUID, Name (en), Unit (en), UnitGroup UUID, Country/-ies
 *
 * The "Country/-ies" column may contain comma-separated country names inside quotes.
 */
export function parseCountryIndicatorCSV(csv: string): CountryIndicator[] {
  const lines = csv.split(/\r?\n/);
  const indicators: CountryIndicator[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    const uuid = fields[0].trim();
    if (!uuid || uuid.length < 30) continue;

    const countriesRaw = fields[4] ? fields[4].trim() : '';
    const countries = countriesRaw
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    indicators.push({
      uuid,
      version: '',
      nameEn: fields[1].trim(),
      unitEn: fields[2].trim(),
      unitGroupUuid: fields[3].trim(),
      nameDe: '',
      unitDe: '',
      category: 'lcia',
      countries,
    });
  }

  return indicators;
}

/**
 * Parse Common_references.csv.
 * Columns: Name, Dataset type, UUID, Version
 */
export function parseCommonReferencesCSV(csv: string): CommonReference[] {
  const lines = csv.split(/\r?\n/);
  const references: CommonReference[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    const name = fields[0] ? fields[0].trim() : '';
    if (!name) continue;

    references.push({
      name,
      datasetType: fields[1] ? fields[1].trim() : '',
      uuid: fields[2] ? fields[2].trim() : '',
      version: fields[3] ? fields[3].trim() : '',
    });
  }

  return references;
}

/**
 * Parse Flow_properties_and_unit_groups.csv.
 * Columns: Flow property, Dataset type, Flow property UUID, Version,
 *          Reference unit, Reference unit group, Dataset type.1,
 *          Reference unit group UUID, Version.1,
 *          alternative flow property UUID (deprecated),
 *          alternative unit group UUID (deprecated)
 */
export function parseFlowPropertiesCSV(csv: string): FlowProperty[] {
  const lines = csv.split(/\r?\n/);
  const properties: FlowProperty[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    const flowProperty = fields[0] ? fields[0].trim() : '';
    if (!flowProperty) continue;

    properties.push({
      flowProperty,
      datasetType: fields[1] ? fields[1].trim() : '',
      flowPropertyUuid: fields[2] ? fields[2].trim() : '',
      version: fields[3] ? fields[3].trim() : '',
      referenceUnit: fields[4] ? fields[4].trim() : '',
      referenceUnitGroup: fields[5] ? fields[5].trim() : '',
      referenceUnitGroupDatasetType: fields[6] ? fields[6].trim() : '',
      referenceUnitGroupUuid: fields[7] ? fields[7].trim() : '',
      versionUnitGroup: fields[8] ? fields[8].trim() : '',
    });
  }

  return properties;
}

/**
 * Parse a Background-database-source-datasets CSV (GaBi or ecoinvent).
 * GaBi columns:      Database Version, Name, UUID
 * ecoinvent columns: Database Version, Name, UUID, version
 */
export function parseBackgroundDbCSV(csv: string, provider: BackgroundDbProvider): BackgroundDatabase[] {
  const lines = csv.split(/\r?\n/);
  const entries: BackgroundDatabase[] = [];
  let headerSkipped = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);

    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }

    const uuid = fields[2] ? fields[2].trim() : '';
    if (!uuid) continue;

    entries.push({
      provider,
      databaseVersion: fields[0] ? fields[0].trim() : '',
      name: fields[1] ? fields[1].trim() : '',
      uuid,
    });
  }

  return entries;
}
