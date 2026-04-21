import type { GuardResult, PostForCheck } from "./types";
import { checkMetaTitle } from "./meta-title";
import { checkMetaDescription } from "./meta-description";
import { checkSingleH1 } from "./single-h1";
import { checkHeadingHierarchy } from "./heading-hierarchy";
import { checkAltText } from "./alt-text";
import { checkCanonical } from "./canonical";
import { checkSchemaValid } from "./schema-valid";
import { checkMinWords } from "./min-words";
import { checkInternalLinks } from "./internal-links";
import { checkReadability } from "./readability";
import { checkNoDuplicate } from "./no-duplicate";

export type { GuardResult, PostForCheck };

export async function runGuardrails(input: PostForCheck): Promise<GuardResult[]> {
  const syncResults: GuardResult[] = [
    checkMetaTitle(input),
    checkMetaDescription(input),
    checkSingleH1(input),
    checkHeadingHierarchy(input),
    checkAltText(input),
    checkCanonical(input),
    checkMinWords(input),
    checkInternalLinks(input),
    checkReadability(input),
  ];

  const asyncResults = await Promise.all([
    checkSchemaValid(input),
    checkNoDuplicate(input),
  ]);

  return [...syncResults, ...asyncResults];
}

export function hasErrors(results: GuardResult[]): boolean {
  return results.some((r) => !r.pass && r.severity === "error");
}
