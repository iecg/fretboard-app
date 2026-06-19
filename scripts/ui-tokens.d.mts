export interface TokenReference {
  name: string;
  line: number;
  hasFallback: boolean;
  file?: string;
}

export function parseDefinitions(css: string): string[];
export function parseReferences(css: string): TokenReference[];
export function parseInlineDefinitions(tsx: string): string[];
export function findUndefined(defined: Set<string>, refs: TokenReference[]): TokenReference[];
export const EXTERNAL_TOKEN_PREFIXES: string[];
