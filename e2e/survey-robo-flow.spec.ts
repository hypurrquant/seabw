import { expect, test } from "@playwright/test";
import { connectMockWallet, fillBalancedSurvey } from "./_helpers";

test("Balanced robo flow: survey → AI mode → plan-review with DAG", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the 1-page risk quiz/i }).click();

  await fillBalancedSurvey(page);
  await expect(page.getByRole("heading", { name: /Balanced/i })).toBeVisible();

  await page.getByRole("button", { name: /AI picks for me/i }).click();
  await connectMockWallet(page);

  await expect(page.getByRole("heading", { name: /What do you want to do/i })).toBeVisible({
    timeout: 5_000,
  });
  await page.getByPlaceholder(/\$3,000 USDC/).fill("$3000 USDC, want yield");
  await page.getByRole("button", { name: /Build plan/i }).click();

  await expect(page.getByRole("heading", { name: /Your plan/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Approve & sign/i)).toBeVisible();
  // Balanced fixture produces 4 steps
  await expect(page.getByText(/Aggregate/i)).toBeVisible();
});
