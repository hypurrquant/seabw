import type { Answers, TierResult } from "@/domains/survey/lib";

// Convert the survey result into a markdown block that the web sends as
// the first user message to HQ chat. The same data is also bound to the
// HQ session via the `profile` field on session creation; the first
// message is a redundancy aid so the model can react contextually before
// the system prompt block is processed.

export function buildTendencyPrompt(answers: Answers, tier: TierResult): string {
  return [
    "## My investor profile",
    "",
    `- **Tier**: \`${tier.tier}\` (rawScore ${tier.rawScore})`,
    tier.downgradedFromDegen
      ? `- ⚠ Degen gate not met — automatically adjusted to \`aggressive\``
      : null,
    tier.vulnerableDowngrade
      ? `- ⚠ Vulnerable-consumer self-check triggered a one-tier downgrade`
      : null,
    "",
    "### Survey answers",
    `- Time horizon: ${answers.horizon}/4`,
    `- Share of total financial assets: ${answers.allocation}/4`,
    `- DeFi product experience: ${answers.experienceProducts.join(", ") || "none"}`,
    `- Longest hands-on experience: ${answers.experienceYears}/4`,
    `- Return vs principal preservation: ${answers.returnAttitude}/4`,
    `- Loss tolerance: ${answers.lossTolerance}/4`,
    `- DeFi risk literacy: ${answers.literacy}/4`,
    `- Derivatives / leverage experience: ${answers.derivativeExp}/4`,
    `- Age bucket: ${answers.ageBucket}`,
    `- First time using DefiPilot: ${answers.firstTimeDefiPilot ? "yes" : "no"}`,
    "",
    "Please recommend LP pools that match this profile.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
