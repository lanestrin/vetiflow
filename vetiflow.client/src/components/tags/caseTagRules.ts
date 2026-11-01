import type { CaseTagTone } from "../../types/CaseTag";

// The limits on a case's tags (build plan 3.5a). They mirror CaseTagRules on the
// server, which still decides: a refused add shows the server's reason.
export const caseTagMaxCount = 5;

export const caseTagMaxTextLength = 40;

export const caseTagTones: { value: CaseTagTone; label: string }[] = [
  { value: "alert", label: "Alert" },
  { value: "caution", label: "Caution" },
  { value: "info", label: "Info" },
  { value: "neutral", label: "Neutral" }
];

// The tone is also named in words, so no tag relies on its colour alone.
export function caseTagToneLabel(tone: CaseTagTone): string {
  return caseTagTones.find((option) => option.value === tone)?.label ?? tone;
}
