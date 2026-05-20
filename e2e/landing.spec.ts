import { expect, test } from "@playwright/test";

test("landing renders headline and routes to survey via Start CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Tell us your DeFi goal/i })).toBeVisible();
  await expect(page.getByText(/build the plan/i)).toBeVisible();
  await page.getByRole("button", { name: /Start the 1-page risk quiz/i }).click();
  await expect(page.getByRole("heading", { name: /risk capacity/i })).toBeVisible();
});

test("demo banner shows on non-prod env", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/DEMO — funds are fake/i)).toBeVisible();
});
