import { expect, test } from '@playwright/test'

test('shows the ForFire landing page from the repository base path', async ({ page }) => {
  const response = await page.goto('/forfire/')
  expect(response?.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: /Prédiction du risque/ })).toBeVisible()
  await expect(page.getByText('Sara CHARRADA (ENISo)')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Format de soumission' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create a student account' })).toHaveCount(0)
})

test('sign-in opens the sample class instead of an account form', async ({ page }) => {
  await page.goto('/forfire/#/sign-in')
  await expect(page.getByRole('heading', { name: 'Your assignments' })).toBeVisible()
  await expect(page.getByLabel('Role')).toHaveCount(0)
})

test('opens the student pages without an account', async ({ page }) => {
  await page.goto('/forfire/#/student/submissions')
  await expect(page.getByRole('heading', { name: 'My submissions' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My submissions' })).toBeVisible()
  await expect(page).toHaveURL(/#\/student\/submissions/)
})

test('unknown hash routes stay inside the app', async ({ page }) => {
  await page.goto('/forfire/#/not-a-real-page')
  await expect(page.getByRole('heading', { name: 'That page is not in ForFire.' })).toBeVisible()
})

test('mobile navigation opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/forfire/')
  const menu = page.getByRole('button', { name: 'Menu' })
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#site-nav')).toBeVisible()
})

test('sign-up opens the sample class instead of an account form', async ({ page }) => {
  await page.goto('/forfire/#/sign-up')
  await expect(page.getByRole('heading', { name: 'Your assignments' })).toBeVisible()
  await expect(page.getByLabel('Role')).toHaveCount(0)
})
