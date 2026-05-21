# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: landing.spec.ts >> landing renders headline and routes to survey via Start CTA
- Location: e2e/landing.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Put your stablecoins to work/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /Put your stablecoins to work/i })

```

```yaml
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- link "Next.js 15.5.18 (outdated) Turbopack":
  - /url: https://nextjs.org/docs/messages/version-staleness
  - img
  - text: Next.js 15.5.18 (outdated) Turbopack
- img
- dialog "Build Error":
  - text: Build Error
  - button "Copy Error Info":
    - img
  - link "Go to related documentation":
    - /url: https://nextjs.org/docs/messages/module-not-found
    - img
  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools":
    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
    - img
  - paragraph: "Module not found: Can't resolve '@hq/core/config/chains'"
  - img
  - text: ./apps/web/src/domains/agent/tools/get-native-balance.ts (11:1)
  - button "Open in editor":
    - img
  - text: "Module not found: Can't resolve '@hq/core/config/chains' 9 | import type { BrowserToolHandler } from './BrowserToolRegistry'; 10 | import type { RegistryDeps } from './index'; > 11 | import { SUPPORTED_CHAINS } from '@hq/core/config/chains'; | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 12 | import { formatUnits } from 'viem'; 13 | import { assertHex } from '@hq/core/lib/type-guard'; 14 | Import traces: Client Component Browser: ./apps/web/src/domains/agent/tools/get-native-balance.ts [Client Component Browser] ./apps/web/src/domains/agent/tools/index.ts [Client Component Browser] ./apps/web/src/domains/agent/providers/AgentRuntimeProvider.tsx [Client Component Browser] ./apps/web/src/components/providers.tsx [Client Component Browser] ./apps/web/src/components/providers.tsx [Server Component] ./apps/web/src/app/layout.tsx [Server Component] Client Component SSR: ./apps/web/src/domains/agent/tools/get-native-balance.ts [Client Component SSR] ./apps/web/src/domains/agent/tools/index.ts [Client Component SSR] ./apps/web/src/domains/agent/providers/AgentRuntimeProvider.tsx [Client Component SSR] ./apps/web/src/components/providers.tsx [Client Component SSR] ./apps/web/src/components/providers.tsx [Server Component] ./apps/web/src/app/layout.tsx [Server Component]"
  - link "https://nextjs.org/docs/messages/module-not-found":
    - /url: https://nextjs.org/docs/messages/module-not-found
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- alert
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test("landing renders headline and routes to survey via Start CTA", async ({ page }) => {
  4  |   await page.goto("/");
> 5  |   await expect(page.getByRole("heading", { name: /Put your stablecoins to work/i })).toBeVisible();
     |                                                                                      ^ Error: expect(locator).toBeVisible() failed
  6  |   await expect(page.getByText(/draft the plan/i)).toBeVisible();
  7  |   await page.getByRole("button", { name: /Start the 1-page risk quiz/i }).click();
  8  |   await expect(page.getByRole("heading", { name: /risk capacity/i })).toBeVisible();
  9  | });
  10 | 
  11 | test("demo banner shows on non-prod env", async ({ page }) => {
  12 |   await page.goto("/");
  13 |   await expect(page.getByText(/DEMO — funds are fake/i)).toBeVisible();
  14 | });
  15 | 
```