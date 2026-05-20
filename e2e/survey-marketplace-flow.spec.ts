import { expect, test } from "@playwright/test";
import { connectMockWallet, fillBalancedSurvey } from "./_helpers";

test("Marketplace flow: filter → product detail → basket → plan", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the 1-page risk quiz/i }).click();

  await fillBalancedSurvey(page);
  await expect(page.getByRole("heading", { name: /Balanced/i })).toBeVisible();

  await page.getByRole("button", { name: /I'll compare myself/i }).click();
  await connectMockWallet(page);

  // Marketplace
  await expect(page.getByRole("heading", { name: /Compare yields/i })).toBeVisible({ timeout: 10_000 });

  // Wait for the catalog to load (await first "Add" button)
  const firstAdd = page.getByRole("button", { name: /^Add$/ }).first();
  await firstAdd.waitFor({ timeout: 10_000 });

  // Click into a pool to open ProductDetail
  await page.getByText(/USDC supply/i).first().click();
  await expect(page.getByText(/APR breakdown/i)).toBeVisible();
  await page.getByRole("button", { name: /Add to basket/i }).click();

  // Basket bar should appear
  await expect(page.getByText(/Basket:/i)).toBeVisible();
  await page.getByRole("button", { name: /Review basket/i }).click();

  // Basket review
  await expect(page.getByRole("heading", { name: /Allocate/i })).toBeVisible();
  await page.getByRole("button", { name: /Build plan from basket/i }).click();

  // Should reach plan-review
  await expect(page.getByRole("heading", { name: /Your plan/i })).toBeVisible({ timeout: 15_000 });
});
