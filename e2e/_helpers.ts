import { type Page, expect } from "@playwright/test";

export interface SurveyScores {
  horizon: number;
  allocation: number;
  experienceYears: number;
  returnAttitude: number;
  lossTolerance: number;
  literacy: number;
  derivativeExp: number;
}

export interface SurveyOptions {
  multiProducts?: string[];   // labels visible on UI (e.g. "Lending", "Leveraged")
  ageOver65?: boolean;
  firstTimeDefi?: boolean;
}

// Pick a single-select +N option within a specific question card. The cards
// are stacked top-to-bottom; we locate by Q-number Pill (Q1..Q8) so labels can
// be reused across cards safely.
async function pickInQ(page: Page, qNumber: number, score: number) {
  const card = page
    .locator("section")
    .filter({ has: page.locator("span").getByText(`Q${qNumber}`, { exact: true }) })
    .first();
  await card.getByRole("button", { name: new RegExp(`\\+${score}$`) }).first().click();
}

// Fills the single-page survey: all 8 questions + meta consent.
export async function fillSurveyFull(
  page: Page,
  scores: SurveyScores,
  opts: SurveyOptions = {},
) {
  await pickInQ(page, 1, scores.horizon);
  await pickInQ(page, 2, scores.allocation);

  // Q3 multi-select — toggle labelled buttons inside the Q3 card
  const q3Card = page
    .locator("section")
    .filter({ has: page.locator("span").getByText("Q3", { exact: true }) })
    .first();
  for (const label of opts.multiProducts ?? []) {
    await q3Card.getByRole("button", { name: new RegExp(label, "i") }).first().click();
  }

  await pickInQ(page, 4, scores.experienceYears);
  await pickInQ(page, 5, scores.returnAttitude);
  await pickInQ(page, 6, scores.lossTolerance);
  await pickInQ(page, 7, scores.literacy);
  await pickInQ(page, 8, scores.derivativeExp);

  if (opts.ageOver65) {
    await page.getByText(/I am 65 or older/i).first().click();
  }
  if (opts.firstTimeDefi) {
    await page.getByText(/DeFi is brand new/i).first().click();
  }

  await page.getByRole("button", { name: /See my tier/i }).click();
}

export async function fillBalancedSurvey(page: Page) {
  return fillSurveyFull(
    page,
    {
      horizon: 2,
      allocation: 3,
      experienceYears: 2,
      returnAttitude: 2,
      lossTolerance: 3,
      literacy: 4,
      derivativeExp: 1,
    },
    { multiProducts: ["Aave"] },
  );
}

export async function fillDegenWithLowLiteracySurvey(page: Page) {
  return fillSurveyFull(
    page,
    {
      horizon: 4,
      allocation: 1,
      experienceYears: 4,
      returnAttitude: 4,
      lossTolerance: 4,
      literacy: 1,             // ← triggers Degen → Aggressive downgrade
      derivativeExp: 1,
    },
    { multiProducts: ["Leveraged", "Perpetual"] },
  );
}

export async function connectMockWallet(page: Page) {
  await expect(page.getByRole("heading", { name: /Connect your wallet/i })).toBeVisible();
  await page.getByRole("button", { name: /Mock Connector/i }).click();
  await expect(page.getByText(/Connected/i)).toBeVisible({ timeout: 5_000 });
}
