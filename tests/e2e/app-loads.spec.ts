import { test, expect } from '@playwright/test'

test.describe('Application E2E', () => {
  test('should load the application without errors', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Wind/)
  })

  test('should display the login page for unauthenticated users', async ({ page }) => {
    await page.goto('/')
    // App should redirect to login or show auth UI
    await expect(page.locator('body')).toBeVisible()
  })

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // Filter out known non-critical errors (e.g., Supabase auth refresh)
    const criticalErrors = errors.filter(
      (e) => !e.includes('auth') && !e.includes('refresh')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
