import { expect, test } from "@playwright/test";

test("/risks renders the canonical 6 risk explanations", async ({ page }) => {
  await page.goto("/risks");
  await expect(page.getByRole("heading", { name: /DeFi risks/i })).toBeVisible();
  for (const heading of [
    "Smart-contract bugs",
    "Impermanent loss",
    "Rug pulls",
    "MEV",
    "Liquidation",
    "Bridge",
  ]) {
    await expect(page.getByText(new RegExp(heading, "i")).first()).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /back to DefiPilot/i })).toBeVisible();
});
