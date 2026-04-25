import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EPDDataset } from '../model/epd-dataset';
import { createEmptyDataset } from '../model/epd-dataset';
import type { StandardVersion, ModuleName } from '../schema/types';

interface EPDStoreState {
  dataset: EPDDataset;
  currentStep: number;
  selectedCountry: string | null;

  setStep: (step: number) => void;
  setStandardVersion: (version: StandardVersion) => void;
  setCountry: (country: string | null) => void;
  updateProcessInfo: (partial: Partial<EPDDataset['processInfo']>) => void;
  updateProductFlow: (partial: Partial<EPDDataset['productFlow']>) => void;
  updateOrganisations: (partial: Partial<EPDDataset['organisations']>) => void;
  toggleModule: (module: ModuleName) => void;
  updateSources: (partial: Partial<EPDDataset['sources']>) => void;
  updateDataset: (partial: Partial<EPDDataset>) => void;
  reset: () => void;
}

export const useEPDStore = create<EPDStoreState>()(
  persist(
    (set) => ({
      dataset: createEmptyDataset(),
      currentStep: 0,
      selectedCountry: null,

      setStep: (step) => set({ currentStep: step }),

      setStandardVersion: (version) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            meta: { ...state.dataset.meta, standardVersion: version },
            exchanges: [],
            lciaResults: [],
          },
        })),

      setCountry: (country) => set({ selectedCountry: country }),

      updateProcessInfo: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            processInfo: { ...state.dataset.processInfo, ...partial },
          },
        })),

      updateProductFlow: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            productFlow: { ...state.dataset.productFlow, ...partial },
          },
        })),

      updateOrganisations: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            organisations: { ...state.dataset.organisations, ...partial },
          },
        })),

      toggleModule: (module) =>
        set((state) => {
          const modules = new Set(state.dataset.declaredModules);
          if (modules.has(module)) {
            modules.delete(module);
          } else {
            modules.add(module);
          }
          return {
            dataset: { ...state.dataset, declaredModules: modules },
          };
        }),

      updateSources: (partial) =>
        set((state) => ({
          dataset: {
            ...state.dataset,
            sources: { ...state.dataset.sources, ...partial },
          },
        })),

      updateDataset: (partial) =>
        set((state) => ({
          dataset: { ...state.dataset, ...partial },
        })),

      reset: () =>
        set({
          dataset: createEmptyDataset(),
          currentStep: 0,
          selectedCountry: null,
        }),
    }),
    {
      name: 'epd-store',
      storage: {
        getItem: (name) => {
          const item = localStorage.getItem(name);
          if (!item) return null;
          const parsed = JSON.parse(item);
          // Deserialize Set<ModuleName> from array
          if (parsed?.state?.dataset?.declaredModules) {
            parsed.state.dataset.declaredModules = new Set(
              parsed.state.dataset.declaredModules
            );
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Serialize Set<ModuleName> to array for JSON storage
          const toStore = {
            ...value,
            state: {
              ...value.state,
              dataset: {
                ...value.state.dataset,
                declaredModules: Array.from(
                  value.state.dataset.declaredModules
                ),
              },
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
