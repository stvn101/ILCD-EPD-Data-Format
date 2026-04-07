import type { EPDDataset, Exchange, LCIAResult } from '../model/epd-dataset';
import type { MultiLangString } from '../schema/types';

function getEnShortDescription(strings: MultiLangString[]): string {
  const en = strings.find(s => s.lang === 'en');
  return en ? en.value : (strings[0]?.value ?? '');
}

function buildAmounts(
  amounts: Array<{ module: string; scenario?: string; value: number }>
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const a of amounts) {
    const key = a.scenario ? `${a.module}|${a.scenario}` : a.module;
    result[key] = a.value;
  }
  return result;
}

function serializeExchange(exchange: Exchange) {
  return {
    uuid: exchange.flowRef.refObjectId,
    name: getEnShortDescription(exchange.flowRef.shortDescription),
    direction: exchange.exchangeDirection,
    unit: getEnShortDescription(exchange.unitGroupRef.shortDescription),
    amounts: buildAmounts(exchange.amounts),
  };
}

function serializeLCIAResult(result: LCIAResult) {
  return {
    uuid: result.methodRef.refObjectId,
    name: getEnShortDescription(result.methodRef.shortDescription),
    unit: getEnShortDescription(result.unitGroupRef.shortDescription),
    amounts: buildAmounts(result.amounts),
  };
}

export function generateJSON(dataset: EPDDataset): string {
  const output = {
    meta: {
      uuid: dataset.meta.uuid,
      standardVersion: dataset.meta.standardVersion,
      subType: dataset.meta.subType,
      dataSetVersion: dataset.meta.dataSetVersion,
    },
    processInfo: {
      name: getEnShortDescription(dataset.processInfo.name),
      referenceYear: dataset.processInfo.referenceYear,
      validUntil: dataset.processInfo.validUntil,
      location: dataset.processInfo.location,
      scenarios: dataset.processInfo.scenarios,
    },
    productFlow: {
      uuid: dataset.productFlow.uuid,
      name: getEnShortDescription(dataset.productFlow.name),
      materialProperties: dataset.productFlow.materialProperties,
    },
    declaredModules: Array.from(dataset.declaredModules),
    exchanges: dataset.exchanges.map(serializeExchange),
    lciaResults: dataset.lciaResults.map(serializeLCIAResult),
  };

  return JSON.stringify(output, null, 2);
}
