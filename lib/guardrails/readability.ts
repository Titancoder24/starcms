import type { GuardResult, PostForCheck } from "./types";
import { fleschReadingEase } from "@/lib/util/readability";

const DEFAULT_THRESHOLD = 50;

export function checkReadability({ post, site }: PostForCheck): GuardResult {
  const threshold = site?.settings?.readabilityThreshold ?? DEFAULT_THRESHOLD;
  const cleanText = post.mdxBody
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/[#*_~\[\]()>]/g, " ");
  const score = Math.round(fleschReadingEase(cleanText));
  const pass = score >= threshold;

  const label =
    score >= 70
      ? "Easy"
      : score >= 60
      ? "Fairly Easy"
      : score >= 50
      ? "Standard"
      : score >= 30
      ? "Difficult"
      : "Very Difficult";

  return {
    code: "readability",
    pass,
    severity: "error",
    message: pass
      ? `Flesch Reading Ease: ${score} (${label}). Above threshold of ${threshold}.`
      : `Flesch Reading Ease: ${score} (${label}). Below threshold of ${threshold}. Text is too complex for most readers.`,
    fix: pass
      ? ""
      : "Simplify the writing: use shorter sentences, prefer common words over jargon, break up long paragraphs. Aim for a Flesch score above 50.",
  };
}
