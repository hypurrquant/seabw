# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> demo banner shows on non-prod env
- Location: e2e/landing.spec.ts:11:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("landing renders headline and routes to survey via Start CTA", async ({ page }) => {
  4  |   await page.goto("/");
  5  |   await expect(page.getByRole("heading", { name: /Put your stablecoins to work/i })).toBeVisible();
  6  |   await expect(page.getByText(/draft the plan/i)).toBeVisible();
  7  |   await page.getByRole("button", { name: /Start the 1-page risk quiz/i }).click();
  8  |   await expect(page.getByRole("heading", { name: /risk capacity/i })).toBeVisible();
  9  | });
  10 | 
  11 | test("demo banner shows on non-prod env", async ({ page }) => {
> 12 |   await page.goto("/");
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  13 |   await expect(page.getByText(/DEMO — funds are fake/i)).toBeVisible();
  14 | });
  15 | 
```