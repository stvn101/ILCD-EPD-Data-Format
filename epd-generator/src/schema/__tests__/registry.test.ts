import { describe, it, expect, beforeAll } from 'vitest';
import { SchemaRegistry } from '../registry';

let registry: SchemaRegistry;

beforeAll(() => {
  registry = SchemaRegistry.create();
});

describe('SchemaRegistry - standard versions', () => {
  it('loads all three standard versions', () => {
    const a1 = registry.getIndicatorSet('+A1');
    const a2ef30 = registry.getIndicatorSet('+A2/EF3.0');
    const a2ef31 = registry.getIndicatorSet('+A2/EF3.1');

    expect(a1.standardVersion).toBe('+A1');
    expect(a2ef30.standardVersion).toBe('+A2/EF3.0');
    expect(a2ef31.standardVersion).toBe('+A2/EF3.1');

    expect(a1.all.length).toBeGreaterThan(0);
    expect(a2ef30.all.length).toBeGreaterThan(0);
    expect(a2ef31.all.length).toBeGreaterThan(0);
  });
});

describe('SchemaRegistry - config features', () => {
  it('+A1 has contentDeclaration=false', () => {
    const config = registry.getConfig('+A1');
    expect(config.features.contentDeclaration).toBe(false);
  });

  it('+A2/EF3.1 has svhc=true', () => {
    const config = registry.getConfig('+A2/EF3.1');
    expect(config.features.svhc).toBe(true);
  });

  it('+A1 has all features false', () => {
    const config = registry.getConfig('+A1');
    const { features } = config;
    expect(features.contentDeclaration).toBe(false);
    expect(features.serviceLife).toBe(false);
    expect(features.svhc).toBe(false);
    expect(features.variability).toBe(false);
    expect(features.manufacturers).toBe(false);
    expect(features.productIds).toBe(false);
    expect(features.scenarioData).toBe(false);
  });

  it('+A2/EF3.1 has all features true', () => {
    const config = registry.getConfig('+A2/EF3.1');
    const { features } = config;
    expect(features.contentDeclaration).toBe(true);
    expect(features.serviceLife).toBe(true);
    expect(features.svhc).toBe(true);
    expect(features.variability).toBe(true);
    expect(features.manufacturers).toBe(true);
    expect(features.productIds).toBe(true);
    expect(features.scenarioData).toBe(true);
  });
});

describe('SchemaRegistry - common references', () => {
  it('loads common references', () => {
    const refs = registry.getCommonReferences();
    expect(refs.length).toBeGreaterThan(0);
  });

  it('contains ILCD Format with correct UUID', () => {
    const refs = registry.getCommonReferences();
    const ilcd = refs.find((r) => r.name === 'ILCD Format');
    expect(ilcd).toBeDefined();
    expect(ilcd!.uuid).toBe('a97a0155-0234-4b87-b4ce-a45da52f2a40');
  });
});

describe('SchemaRegistry - flow properties', () => {
  it('loads flow properties', () => {
    const props = registry.getFlowProperties();
    expect(props.length).toBeGreaterThan(0);
  });

  it('contains Mass with correct UUID', () => {
    const props = registry.getFlowProperties();
    const mass = props.find((p) => p.flowProperty === 'Mass');
    expect(mass).toBeDefined();
    expect(mass!.flowPropertyUuid).toBe('93a60a56-a3c8-11da-a746-0800200b9a66');
  });
});

describe('SchemaRegistry - country-specific indicators', () => {
  it('loads country-specific indicators', () => {
    const indicators = registry.getCountryIndicators();
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('returns Finnish GWP-IOBC indicator', () => {
    const finnishIndicators = registry.getCountryIndicatorsFor('Finland');
    expect(finnishIndicators.length).toBeGreaterThan(0);

    const gwpIobc = finnishIndicators.find(
      (i) => i.uuid === 'fb774615-0575-45de-9a89-1ded92f19770'
    );
    expect(gwpIobc).toBeDefined();
    expect(gwpIobc!.countries).toContain('Finland');
  });

  it('getAvailableCountries returns a sorted list', () => {
    const countries = registry.getAvailableCountries();
    expect(countries.length).toBeGreaterThan(0);

    // Verify sorted order
    const sorted = [...countries].sort();
    expect(countries).toEqual(sorted);

    // Known countries should be present
    expect(countries).toContain('Finland');
    expect(countries).toContain('Germany');
    expect(countries).toContain('Norway');
    expect(countries).toContain('Sweden');
  });
});
