import { describe, it, expect } from 'vitest';
import { createEmptyDataset } from '../epd-dataset';

describe('createEmptyDataset', () => {
  it('creates dataset with default +A2/EF3.1', () => {
    const ds = createEmptyDataset();
    expect(ds.meta.standardVersion).toBe('+A2/EF3.1');
    expect(ds.meta.subType).toBe('specific dataset');
    expect(ds.meta.uuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(ds.meta.dataSetVersion).toBe('00.01.000');
  });

  it('creates dataset with specified version', () => {
    const ds = createEmptyDataset('+A1');
    expect(ds.meta.standardVersion).toBe('+A1');
  });

  it('initializes empty collections', () => {
    const ds = createEmptyDataset();
    expect(ds.exchanges).toEqual([]);
    expect(ds.lciaResults).toEqual([]);
    expect(ds.declaredModules.size).toBe(0);
    expect(ds.organisations.manufacturers).toEqual([]);
  });

  it('generates unique UUIDs', () => {
    const ds1 = createEmptyDataset();
    const ds2 = createEmptyDataset();
    expect(ds1.meta.uuid).not.toBe(ds2.meta.uuid);
    expect(ds1.productFlow.uuid).not.toBe(ds2.productFlow.uuid);
  });
});
