import { expect, test } from "@playwright/test";
import { fillDegenWithLowLiteracySurvey } from "./_helpers";

test("Degen + low literacy is downgraded to Aggressive with disclosure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start the 1-page risk quiz/i }).click();

  await fillDegenWithLowLiteracySurvey(page);

  await expect(page.getByRole("heading", { name: /Aggressive/i })).toBeVisible();
  await expect(page.getByText(/Degen gate not met/i)).toBeVisible();
  await expect(page.getByText(/DeFi risk literacy/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Read the DeFi risk page/i })).toBeVisible();
});
