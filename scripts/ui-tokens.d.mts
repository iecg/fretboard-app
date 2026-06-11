// Type declarations for the plain-JS token checker (scripts/ui-tokens.mjs) so
// the Vitest spec in src/styles/__tests__/uiTokens.test.ts type-checks cleanly.

export interface TokenReference {
  name: string;
  line: number;
  hasFallback: boolean;
}

export interface FileTokenReference extends TokenReference {
  file: string;
}

export const EXTERNAL_TOKEN_PREFIXES: string[];

export function parseDefinitions(cssText: string): string[];

export function parseReferences(cssText: string): TokenReference[];

export function parseInlineDefinitions(jsText: string): string[];

export function findUndefined<T extends { name: string; hasFallback: boolean }>(
  definedSet: Set<string>,
  refs: T[],
): T[];

export function listCssFiles(dir: string): string[];

export function collectDefinedTokens(files: string[]): Set<string>;

export function collectReferences(files: string[]): FileTokenReference[];
