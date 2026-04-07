import { describe, it, expect } from 'vitest';
import { generateJSON } from '../json-generator';
import { createEmptyDataset } from '../../model/epd-dataset';
import type { Exchange, LCIAResult } from '../../model/epd-dataset';

function makeExchange(overrides: Partial<Exchange> = {}): Exchange {
  return {
    dataSetInternalID: 1,
    flowRef: {
      type: 'flow data set',
      refObjectId: 'flow-uuid-001',
      shortDescription: [{ lang: 'en', value: 'Steel, low-alloyed' }],
    },
    exchangeDirection: 'Input',
    meanAmount: 1.0,
    amounts: [
      { module: 'A1', value: 0.5 },
      { module: 'A2', value: 0.3 },
      { module: 'A3', scenario: 'ScenA', value: 0.2 },
    ],
    unitGroupRef: {
      type: 'unit group data set',
      refObjectId: 'ug-uuid-001',
      shortDescription: [{ lang: 'en', value: 'kg' }],
    },
    ...overrides,
  };
}

function makeLCIAResult(overrides: Partial<LCIAResult> = {}): LCIAResult {
  return {
    methodRef: {
      type: 'LCIA method data set',
      refObjectId: 'lcia-method-uuid-999',
      shortDescription: [{ lang: 'en', value: 'GWP total' }],
    },
    meanAmount: 42.0,
    amounts: [
      { module: 'A1', value: 10.0 },
      { module: 'A2', value: 5.0 },
    ],
    unitGroupRef: {
      type: 'unit group data set',
      refObjectId: 'ug-uuid-co2',
      shortDescription: [{ lang: 'en', value: 'kg CO2 eq.' }],
    },
    ...overrides,
  };
}

describe('generateJSON', () => {
  it('produces a valid JSON string', () => {
    const dataset = createEmptyDataset();
    const result = generateJSON(dataset);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('contains meta.uuid from the dataset', () => {
    const dataset = createEmptyDataset();
    const result = generateJSON(dataset);
    const parsed = JSON.parse(result);
    expect(parsed.meta.uuid).toBe(dataset.meta.uuid);
  });

  it('serializes lciaResults with uuid from methodRef', () => {
    const dataset = createEmptyDataset();
    dataset.lciaResults.push(makeLCIAResult());
    const result = generateJSON(dataset);
    const parsed = JSON.parse(result);
    expect(parsed.lciaResults).toHaveLength(1);
    expect(parsed.lciaResults[0].uuid).toBe('lcia-method-uuid-999');
    expect(parsed.lciaResults[0].name).toBe('GWP total');
  });

  it('converts declaredModules Set to an array', () => {
    const dataset = createEmptyDataset();
    dataset.declaredModules.add('A1');
    dataset.declaredModules.add('A2');
    dataset.declaredModules.add('A3');
    const result = generateJSON(dataset);
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed.declaredModules)).toBe(true);
    expect(parsed.declaredModules).toContain('A1');
    expect(parsed.declaredModules).toContain('A2');
    expect(parsed.declaredModules).toContain('A3');
  });

  it('creates module-keyed amounts object for exchanges', () => {
    const dataset = createEmptyDataset();
    dataset.exchanges.push(makeExchange());
    const result = generateJSON(dataset);
    const parsed = JSON.parse(result);
    expect(parsed.exchanges).toHaveLength(1);
    const exchange = parsed.exchanges[0];
    // Plain module key
    expect(exchange.amounts['A1']).toBe(0.5);
    expect(exchange.amounts['A2']).toBe(0.3);
    // Module|scenario composite key
    expect(exchange.amounts['A3|ScenA']).toBe(0.2);
    // uuid comes from flowRef
    expect(exchange.uuid).toBe('flow-uuid-001');
    expect(exchange.unit).toBe('kg');
  });
});
