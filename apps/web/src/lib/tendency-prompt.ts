import type { Answers, TierResult } from "@/domains/survey/lib";

// Convert the survey result into a markdown block that the web sends as
// the first user message to HQ chat. The same data is also bound to the
// HQ session via the `profile` field on session creation; the first
// message is a redundancy aid so the model can react contextually before
// the system prompt block is processed.

export function buildTendencyPrompt(answers: Answers, tier: TierResult): string {
  return [
    "## 제 투자자 성향 분석 결과",
    "",
    `- **Tier**: \`${tier.tier}\` (rawScore ${tier.rawScore})`,
    tier.downgradedFromDegen ? `- ⚠ Degen 기준 충족 못해 자동 \`aggressive\`로 조정됨` : null,
    tier.vulnerableDowngrade ? `- ⚠ 취약 소비자 자기진단으로 한 단계 자동 하향됨` : null,
    "",
    "### 설문 응답",
    `- 투자 기간 (horizon): ${answers.horizon}/4`,
    `- 자산 비중 (allocation): ${answers.allocation}/4`,
    `- DeFi 경험 카테고리: ${answers.experienceProducts.join(", ") || "없음"}`,
    `- 가장 오래 사용해본 기간 (experienceYears): ${answers.experienceYears}/4`,
    `- 수익 vs 원금보전 (returnAttitude): ${answers.returnAttitude}/4`,
    `- 손실 감내 (lossTolerance): ${answers.lossTolerance}/4`,
    `- 리스크 리터러시 (literacy): ${answers.literacy}/4`,
    `- 파생/레버리지 경험 (derivativeExp): ${answers.derivativeExp}/4`,
    `- 연령대: ${answers.ageBucket}`,
    `- DefiPilot 첫 사용: ${answers.firstTimeDefiPilot ? "예" : "아니오"}`,
    "",
    "이 결과를 바탕으로 제 성향에 맞는 LP 풀을 추천해주세요.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
