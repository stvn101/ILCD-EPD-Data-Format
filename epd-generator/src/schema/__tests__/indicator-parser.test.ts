import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  parseIndicatorCSV,
  parseCountryIndicatorCSV,
  parseCommonReferencesCSV,
  parseFlowPropertiesCSV,
  parseBackgroundDbCSV,
} from '../indicator-parser';

// __dirname = epd-generator/src/schema/__tests__
// Going up 4 levels lands at the top-level ILCD-EPD-Data-Format-release-v1.3 directory.
// The reference data lives inside the nested ILCD-EPD-Data-Format-release-v1.3 sub-folder.
const REPO_ROOT = resolve(__dirname, '../../../../ILCD-EPD-Data-Format-release-v1.3');
const IDENTIFIERS_DIR = resolve(REPO_ROOT, 'doc/identifiers');

function readCSV(filename: string): string {
  return readFileSync(resolve(IDENTIFIERS_DIR, filename), 'utf-8');
}

describe('parseIndicatorCSV - EN15804+A1', () => {
  const csv = readCSV('EN15804+A1_indicators.csv');
  const result = parseIndicatorCSV(csv, '+A1');

  it('should have 18 exchange indicators', () => {
    expect(result.exchanges).toHaveLength(18);
  });

  it('should have 7 LCIA indicators', () => {
    expect(result.lcia).toHaveLength(7);
  });

  it('should have 25 total indicators', () => {
    expect(result.all).toHaveLength(25);
  });

  it('should set standardVersion correctly', () => {
    expect(result.standardVersion).toBe('+A1');
  });

  it('should set exchange category on exchange indicators', () => {
    expect(result.exchanges.every((i) => i.category === 'exchange')).toBe(true);
  });

  it('should set lcia category on LCIA indicators', () => {
    expect(result.lcia.every((i) => i.category === 'lcia')).toBe(true);
  });

  it('should parse PERE indicator correctly', () => {
    const pere = result.exchanges.find((i) => i.nameEn.includes('PERE'));
    expect(pere).toBeDefined();
    expect(pere!.uuid).toBe('20f32be5-0398-4288-9b6d-accddd195317');
    expect(pere!.unitEn).toBe('MJ');
  });
});

describe('parseIndicatorCSV - EN15804+A2 EF3.0', () => {
  const csv = readCSV('EN15804+A2_EF3.0_indicators.csv');
  const result = parseIndicatorCSV(csv, '+A2/EF3.0');

  it('should have 18 exchange indicators', () => {
    expect(result.exchanges).toHaveLength(18);
  });

  it('should have 19 LCIA indicators', () => {
    expect(result.lcia).toHaveLength(19);
  });

  it('should have 37 total indicators', () => {
    expect(result.all).toHaveLength(37);
  });

  it('should set standardVersion correctly', () => {
    expect(result.standardVersion).toBe('+A2/EF3.0');
  });

  it('should parse version field on LCIA indicators', () => {
    const gwp = result.lcia.find((i) => i.nameEn.includes('GWP-total'));
    expect(gwp).toBeDefined();
    expect(gwp!.version).toBe('04.00.016');
  });
});

describe('parseIndicatorCSV - EN15804+A2 EF3.1', () => {
  const csv = readCSV('EN15804+A2_EF3.1_indicators.csv');
  const result = parseIndicatorCSV(csv, '+A2/EF3.1');

  it('should have 18 exchange indicators', () => {
    expect(result.exchanges).toHaveLength(18);
  });

  it('should have 19 LCIA indicators', () => {
    expect(result.lcia).toHaveLength(19);
  });

  it('should verify GWP-total UUID is a7ea142a-9749-11ed-a8fc-0242ac120002', () => {
    const gwpTotal = result.lcia.find((i) => i.nameEn === 'Global Warming Potential - total (GWP-total)');
    expect(gwpTotal).toBeDefined();
    expect(gwpTotal!.uuid).toBe('a7ea142a-9749-11ed-a8fc-0242ac120002');
  });

  it('should set standardVersion correctly', () => {
    expect(result.standardVersion).toBe('+A2/EF3.1');
  });
});

describe('parseCountryIndicatorCSV', () => {
  const csv = readCSV('Country-specific_indicators.csv');
  const result = parseCountryIndicatorCSV(csv);

  it('should return an array of country indicators', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('should find Finnish GWP-IOBC indicator (EF 3.0)', () => {
    const gwpIobc = result.find(
      (i) => i.nameEn.includes('GWP-IOBC') && i.countries.includes('Finland')
    );
    expect(gwpIobc).toBeDefined();
    expect(gwpIobc!.countries).toContain('Finland');
  });

  it('should parse multi-country indicators correctly', () => {
    const nordic = result.find((i) => i.countries.includes('Norway'));
    expect(nordic).toBeDefined();
    expect(nordic!.countries).toContain('Sweden');
  });

  it('should parse single-country (Germany) indicators', () => {
    const german = result.filter((i) => i.countries.length === 1 && i.countries[0] === 'Germany');
    expect(german.length).toBeGreaterThan(0);
  });
});

describe('parseCommonReferencesCSV', () => {
  const csv = readCSV('Common_references.csv');
  const result = parseCommonReferencesCSV(csv);

  it('should return an array of common references', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('should verify ILCD Format UUID is a97a0155-0234-4b87-b4ce-a45da52f2a40', () => {
    const ilcd = result.find((r) => r.name === 'ILCD Format');
    expect(ilcd).toBeDefined();
    expect(ilcd!.uuid).toBe('a97a0155-0234-4b87-b4ce-a45da52f2a40');
  });

  it('should parse dataset type correctly', () => {
    const ilcd = result.find((r) => r.name === 'ILCD Format');
    expect(ilcd!.datasetType).toBe('source data set');
  });

  it('should include EN 15804+A1 reference', () => {
    const en = result.find((r) => r.name === 'EN 15804+A1');
    expect(en).toBeDefined();
    expect(en!.uuid).toBe('b00f9ec0-7874-11e3-981f-0800200c9a66');
  });
});

describe('parseFlowPropertiesCSV', () => {
  const csv = readCSV('Flow_properties_and_unit_groups.csv');
  const result = parseFlowPropertiesCSV(csv);

  it('should return an array of flow properties', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('should verify Mass UUID is 93a60a56-a3c8-11da-a746-0800200b9a66', () => {
    const mass = result.find((fp) => fp.flowProperty === 'Mass');
    expect(mass).toBeDefined();
    expect(mass!.flowPropertyUuid).toBe('93a60a56-a3c8-11da-a746-0800200b9a66');
  });

  it('should parse Mass reference unit correctly', () => {
    const mass = result.find((fp) => fp.flowProperty === 'Mass');
    expect(mass!.referenceUnit).toBe('kg');
  });

  it('should include Volume flow property', () => {
    const volume = result.find((fp) => fp.flowProperty === 'Volume');
    expect(volume).toBeDefined();
  });

  it('should include Carbon content (biogenic) flow property', () => {
    const carbon = result.find((fp) => fp.flowProperty === 'Carbon content (biogenic)');
    expect(carbon).toBeDefined();
  });
});

describe('parseBackgroundDbCSV - GaBi', () => {
  const csv = readCSV('BackgroundDB_SourceDatasets_GaBi.csv');
  const result = parseBackgroundDbCSV(csv, 'GaBi');

  it('should return at least one entry', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('should set provider to GaBi on every entry', () => {
    expect(result.every((e) => e.provider === 'GaBi')).toBe(true);
  });

  it('should resolve "GaBi Database (general)" to UUID 28d74cc0-db8b-4d7e-bc44-5f6d56ce0c4a', () => {
    const general = result.find((e) => e.databaseVersion === 'all');
    expect(general).toBeDefined();
    expect(general!.name).toBe('GaBi Database (general)');
    expect(general!.uuid).toBe('28d74cc0-db8b-4d7e-bc44-5f6d56ce0c4a');
  });

  it('should parse a Sphera MLC entry with quoted commas in name', () => {
    const sphera = result.find((e) => e.name.includes('Sphera MLC'));
    expect(sphera).toBeDefined();
  });
});

describe('parseBackgroundDbCSV - ecoinvent', () => {
  const csv = readCSV('BackgroundDB_SourceDatasets_ecoinvent.csv');
  const result = parseBackgroundDbCSV(csv, 'ecoinvent');

  it('should return at least one entry', () => {
    expect(result.length).toBeGreaterThan(0);
  });

  it('should set provider to ecoinvent on every entry', () => {
    expect(result.every((e) => e.provider === 'ecoinvent')).toBe(true);
  });

  it('should resolve "ecoinvent database (general)" to UUID b497a91f-e14b-4b69-8f28-f50eb1576766', () => {
    const general = result.find((e) => e.databaseVersion === 'all');
    expect(general).toBeDefined();
    expect(general!.name).toBe('ecoinvent database (general)');
    expect(general!.uuid).toBe('b497a91f-e14b-4b69-8f28-f50eb1576766');
  });

  it('should parse all ecoinvent versions including 3.10', () => {
    const v310 = result.find((e) => e.databaseVersion === '3.10');
    expect(v310).toBeDefined();
    expect(v310!.uuid).toBe('6edab576-5247-472f-a2f4-0cb84561ca8b');
  });
});
