import { expect, test, type Page } from "@playwright/test";

function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true });
}

async function loadSampleShortlist(page: Page) {
  await page.goto("/upload");
  await page.getByRole("button", { name: "Try with sample data" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("scouting companion flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("upload → front page → ledger → dossier → watch → compare", async ({ page }) => {
    await loadSampleShortlist(page);

    await expect(page.getByText("Today's briefs")).toBeVisible();

    await navLink(page, "Scout").click();
    await expect(page).toHaveURL(/\/scout/);
    await expect(page.getByText(/\d+ shown/)).toBeVisible();

    const search = page.getByPlaceholder("Player name…");
    await search.fill("Malcom");
    await expect(page).toHaveURL(/q=Malcom/);
    await expect(page.getByRole("link", { name: "Malcom" })).toBeVisible();

    await page.getByRole("link", { name: "Malcom" }).click();
    await expect(page).toHaveURL(/\/scout\/shortlist\//);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Malcom");

    const watchBtn = page.getByRole("button", { name: "Add to watch" });
    await watchBtn.click();
    await expect(page.getByRole("button", { name: "Remove from watch" })).toBeVisible();

    await navLink(page, "Watch").click();
    await expect(page.getByRole("link", { name: "Malcom" })).toBeVisible();

    await navLink(page, "Scout").click();
    await page.getByRole("link", { name: "Malcom" }).click();
    await page.locator(".footline").getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/compare\?a=shortlist:/);

    const anchorId = new URL(page.url()).searchParams.get("a")?.split(":")[1];
    const addPlayer = page.getByLabel("Add player");
    const secondValue = await addPlayer.evaluate((el, skipId) => {
      const opts = [...(el as HTMLSelectElement).options];
      const hit = opts.find((o) => o.value.startsWith("shortlist:") && !o.value.endsWith(`:${skipId}`));
      return hit?.value ?? null;
    }, anchorId);
    expect(secondValue).toBeTruthy();
    await addPlayer.selectOption(secondValue!);
    await expect(page.getByText("2 of 2 loaded")).toBeVisible();
    await expect(page.locator(".cmp-heads .cmp-head")).toHaveCount(2);
  });

  test("ledger filter URL round-trips in the same browser profile", async ({ page, context }) => {
    await loadSampleShortlist(page);

    await navLink(page, "Scout").click();
    const search = page.getByPlaceholder("Player name…");
    await search.fill("Malcom");
    await expect(page.getByText("1 shown")).toBeVisible();
    const filteredUrl = page.url();

    const second = await context.newPage();
    await second.goto(filteredUrl);
    await expect(second.getByPlaceholder("Player name…")).toHaveValue("Malcom");
    await expect(second.getByText("1 shown")).toBeVisible();
    await expect(second.getByRole("link", { name: "Malcom" })).toHaveCount(1);
    await second.close();
  });
});
