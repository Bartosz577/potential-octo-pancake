import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'
import os from 'os'

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/namos-vdek-5rows.txt')
const IS_CI = !!process.env.CI

let electronApp: ElectronApplication
let page: Page

test.beforeAll(async () => {
  const args = IS_CI ? ['.', '--no-sandbox'] : ['.']
  electronApp = await electron.launch({ args })
  page = await electronApp.firstWindow()

  // Mock native dialogs in the main process
  const tmpSavePath = path.join(os.tmpdir(), `jpk-e2e-${Date.now()}.xml`)
  await electronApp.evaluate(
    ({ dialog }, args) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [args.fixturePath]
      })) as typeof dialog.showOpenDialog
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: args.savePath
      })) as typeof dialog.showSaveDialog
    },
    { fixturePath: FIXTURE_PATH, savePath: tmpSavePath }
  )
})

test.afterAll(async () => {
  if (electronApp) await electronApp.close()
})

test('full 7-step import-to-export wizard', async () => {
  // ── Step 1: Import ──
  // Click drop zone to trigger mocked file dialog
  await page.locator('text=Przeciągnij pliki tutaj').click()
  // Verify file card appears with filename and row count
  await expect(page.getByText('namos-vdek-5rows.txt', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('5 wierszy')).toBeVisible()
  await page.getByRole('button', { name: 'Dalej' }).click()

  // ── Step 2: Mapping ──
  await expect(page.locator('h1', { hasText: 'Mapowanie kolumn' })).toBeVisible()
  // Auto-mapper runs on mount for NAMOS — wait for "Dalej" to become enabled
  const mappingDalej = page.getByRole('button', { name: 'Dalej' })
  await expect(mappingDalej).toBeEnabled({ timeout: 10_000 })
  await mappingDalej.click()

  // ── Step 3: Company ──
  await expect(page.locator('h1', { hasText: 'Dane podmiotu' })).toBeVisible()
  // Fill required fields
  await page.locator('input[placeholder="0000000000"]').fill('5213000587')
  await page.locator('input[placeholder="Nazwa firmy..."]').fill('Test Firma Sp. z o.o.')
  await page.locator('input[placeholder="0000"]').first().fill('1471')
  // Period defaults to current year/month (2026-02) — no changes needed
  const companyDalej = page.getByRole('button', { name: 'Dalej' })
  await expect(companyDalej).toBeEnabled({ timeout: 5_000 })
  await companyDalej.click()

  // ── Step 4: Preview ──
  await expect(page.locator('h1', { hasText: 'Podgląd danych' })).toBeVisible()
  // Verify data table is rendered with rows
  await expect(page.locator('text=Wierszy: 5')).toBeVisible({ timeout: 5_000 })
  await page.getByRole('button', { name: 'Dalej' }).click()

  // ── Step 5: Validation ──
  await expect(page.locator('h1', { hasText: 'Walidacja danych' })).toBeVisible()

  // If auto-fixable issues exist (e.g. comma decimals), fix them first
  const fixAllBtn = page.getByRole('button', { name: /Napraw automatycznie/ })
  if (await fixAllBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await fixAllBtn.click()
    // Wait for re-validation after fix
    await page.waitForTimeout(500)
  }

  // Verify no blocking errors
  await expect(page.locator('text=Walidacja nieudana')).not.toBeVisible()

  const exportBtn = page.getByRole('button', { name: 'Eksportuj XML' })
  await expect(exportBtn).toBeEnabled({ timeout: 5_000 })
  await exportBtn.click()

  // ── Step 6: Export ──
  await expect(page.locator('h1', { hasText: 'Eksport XML' })).toBeVisible()
  // Verify XML preview contains declaration
  await expect(page.locator('text=<?xml')).toBeVisible({ timeout: 5_000 })

  // Save XML via mocked dialog
  await page.getByRole('button', { name: 'Zapisz XML' }).click()
  // Verify toast appears
  await expect(page.locator('text=/Zapisano:/')).toBeVisible({ timeout: 5_000 })
})
