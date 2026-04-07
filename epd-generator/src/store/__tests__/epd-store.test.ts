import { describe, it, expect, beforeEach } from 'vitest';
import { useEPDStore } from '../epd-store';

describe('EPD Store', () => {
  beforeEach(() => {
    useEPDStore.getState().reset();
  });

  it('initializes with empty dataset', () => {
    const state = useEPDStore.getState();
    expect(state.dataset.meta.standardVersion).toBe('+A2/EF3.1');
    expect(state.currentStep).toBe(0);
    expect(state.selectedCountry).toBeNull();
  });

  it('updates standard version and resets indicators', () => {
    const { setStandardVersion, updateDataset } = useEPDStore.getState();
    // Add some exchanges first
    updateDataset({ exchanges: [{ dataSetInternalID: 1, flowRef: { type: 'flow data set', refObjectId: 'test', shortDescription: [] }, exchangeDirection: 'Input', meanAmount: 0, amounts: [], unitGroupRef: { type: 'unit group data set', refObjectId: 'test', shortDescription: [] } }] });
    expect(useEPDStore.getState().dataset.exchanges.length).toBe(1);

    setStandardVersion('+A1');
    expect(useEPDStore.getState().dataset.meta.standardVersion).toBe('+A1');
    expect(useEPDStore.getState().dataset.exchanges).toEqual([]);
  });

  it('navigates wizard steps', () => {
    useEPDStore.getState().setStep(3);
    expect(useEPDStore.getState().currentStep).toBe(3);
  });

  it('updates process info fields', () => {
    useEPDStore.getState().updateProcessInfo({ referenceYear: 2025 });
    expect(useEPDStore.getState().dataset.processInfo.referenceYear).toBe(2025);
  });

  it('toggles declared modules', () => {
    useEPDStore.getState().toggleModule('A1-A3');
    expect(useEPDStore.getState().dataset.declaredModules.has('A1-A3')).toBe(true);
    useEPDStore.getState().toggleModule('A1-A3');
    expect(useEPDStore.getState().dataset.declaredModules.has('A1-A3')).toBe(false);
  });

  it('sets country', () => {
    useEPDStore.getState().setCountry('Germany');
    expect(useEPDStore.getState().selectedCountry).toBe('Germany');
    useEPDStore.getState().setCountry(null);
    expect(useEPDStore.getState().selectedCountry).toBeNull();
  });
});
