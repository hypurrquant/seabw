import { describe, expect, test } from "vitest";

// Sanity test that the happy-dom environment is actually wired so vitest
// suites that rely on `document`/`window` won't silently fail in node-only env.
describe("happy-dom environment", () => {
  test("document is defined", () => {
    expect(typeof document).toBe("object");
    expect(document.createElement).toBeTypeOf("function");
  });

  test("can render a DOM tree and read it back", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button class="cta">Start</button><span>tier-pill</span>`;
    document.body.appendChild(root);
    const btn = document.querySelector(".cta");
    expect(btn?.textContent).toBe("Start");
    expect(document.body.querySelectorAll("span").length).toBe(1);
    document.body.removeChild(root);
  });

  test("window globals exist", () => {
    expect(typeof window).toBe("object");
    expect(typeof window.localStorage).toBe("object");
  });
});
