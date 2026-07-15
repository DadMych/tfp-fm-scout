import { expect, test, type Page } from "@playwright/test";
import { applyHostedE2EEnv, isHostedE2EEnabled } from "./env";

applyHostedE2EEnv();

const hosted = isHostedE2EEnabled();
const password = "testpass123";

function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true });
}

async function clearBrowserStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("tfp-fm");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  });
}

async function registerAndSignIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Need an account?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

async function loadSampleShortlist(page: Page) {
  await page.goto("/upload");
  await page.getByRole("button", { name: "Try with sample data" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Today's briefs")).toBeVisible({ timeout: 90_000 });
}

test.describe("hosted persistence", () => {
  test.skip(!hosted, "Requires DATABASE_URL and AUTH_SECRET");
  test.setTimeout(180_000);

  test("register → upload → relogin on a fresh context → data persists", async ({ browser }) => {
    const email = `e2e-persist-${Date.now()}@tfp-fm.test`;

    const first = await browser.newContext();
    const page1 = await first.newPage();
    await clearBrowserStorage(page1);
    await registerAndSignIn(page1, email);
    await loadSampleShortlist(page1);

    await navLink(page1, "Scout").click();
    const search = page1.getByPlaceholder("Player name…");
    await search.fill("Malcom");
    await expect(page1.getByText("1 shown")).toBeVisible();
    await page1.getByRole("link", { name: "Malcom" }).click();
    await expect(page1).toHaveURL(/\/scout\/shortlist\//);

    const watchBtn = page1.getByRole("button", { name: "Add to watch" });
    await watchBtn.click();
    await expect(page1.getByRole("button", { name: "Remove from watch" })).toBeVisible();
    await first.close();

    const second = await browser.newContext();
    const page2 = await second.newPage();
    await clearBrowserStorage(page2);
    await signIn(page2, email);

    await navLink(page2, "Scout").click();
    await expect(page2.getByPlaceholder("Player name…")).toHaveValue("");
    await page2.getByPlaceholder("Player name…").fill("Malcom");
    await expect(page2.getByText("1 shown")).toBeVisible();
    await expect(page2.getByRole("link", { name: "Malcom" })).toBeVisible();

    await navLink(page2, "Watch").click();
    await expect(page2.getByRole("link", { name: "Malcom" })).toBeVisible();
    await second.close();
  });

  test("two accounts see isolated datasets", async ({ browser }) => {
    const stamp = Date.now();
    const emailA = `e2e-a-${stamp}@tfp-fm.test`;
    const emailB = `e2e-b-${stamp}@tfp-fm.test`;

    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await clearBrowserStorage(pageA);
    await registerAndSignIn(pageA, emailA);
    await loadSampleShortlist(pageA);

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await clearBrowserStorage(pageB);
    await registerAndSignIn(pageB, emailB);

    await pageB.goto("/scout");
    await expect(pageB.getByText("No shortlist loaded")).toBeVisible({ timeout: 15_000 });

    await pageA.goto("/scout");
    await expect(pageA.getByText(/\d+ shown/)).toBeVisible({ timeout: 45_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
