import { test, expect } from '@playwright/test'

/**
 * Smoke tests — run AFTER production deploy.
 * Only verify that critical paths are alive, not full functionality.
 */
test.describe('Smoke Tests @smoke', () => {
  test('app returns 200 and renders', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
  })

  test('static assets load correctly', async ({ page }) => {
    await page.goto('/')
    // Verify the HTML head contains a favicon link (rel="icon")
    const hasIcon = await page.evaluate(() => {
      const link = document.querySelector('link[rel="icon"]');
      return link !== null;
    });
    expect(hasIcon).toBe(true)
  })

  test('no critical JS errors on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    expect(errors).toHaveLength(0)
  })

  test('API health — Supabase reachable', async ({ request }) => {
    // Verify that Supabase endpoint is reachable (public health)
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    if (supabaseUrl) {
      const response = await request.get(`${supabaseUrl}/rest/v1/`, {
        headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY || '' },
      })
      expect(response.status()).toBeLessThan(500)
    }
  })
})
