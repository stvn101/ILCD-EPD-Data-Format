import type { MultiLangString, Reference } from '../../schema/types';

export function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderMultiLang(
  tagName: string,
  strings: MultiLangString[],
  indent: string,
): string {
  return strings
    .map(s => `${indent}<${tagName} xml:lang="${xmlEscape(s.lang)}">${xmlEscape(s.value)}</${tagName}>`)
    .join('\n');
}

export function renderReference(
  tagName: string,
  ref: Reference,
  indent: string,
): string {
  const attrs = [
    `type="${xmlEscape(ref.type)}"`,
    `refObjectId="${xmlEscape(ref.refObjectId)}"`,
    ref.version != null ? `version="${xmlEscape(ref.version)}"` : null,
    ref.uri != null ? `uri="${xmlEscape(ref.uri)}"` : null,
  ]
    .filter(Boolean)
    .join(' ');

  if (ref.shortDescription.length === 0) {
    return `${indent}<${tagName} ${attrs}/>`;
  }

  const inner = renderMultiLang('common:shortDescription', ref.shortDescription, indent + '  ');
  return `${indent}<${tagName} ${attrs}>\n${inner}\n${indent}</${tagName}>`;
}
