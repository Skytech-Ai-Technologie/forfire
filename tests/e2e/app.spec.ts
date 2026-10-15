import { expect, test } from '@playwright/test'

test('shows the ForFire landing page from the repository base path', async ({ page }) => {
  const response = await page.goto('/forfire/')
  expect(response?.ok()).toBeTruthy()
  await expect(page.getByRole('heading', { name: /Homework with a clear deadline/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create a student account' })).toBeVisible()
})

test('sign-in form is labeled and has no role selector', async ({ page }) => {
  await page.goto('/forfire/#/sign-in')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByLabel('Role')).toHaveCount(0)
})

test('keeps a nested route after refresh', async ({ page }) => {
  await page.goto('/forfire/#/student/submissions')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page).toHaveURL(/#\/sign-in/)
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

test('student sign-up explains that the role is fixed', async ({ page }) => {
  await page.goto('/forfire/#/sign-up')
  await expect(page.getByRole('heading', { name: 'Create a student account' })).toBeVisible()
  await expect(page.getByText(/cannot choose a role/)).toBeVisible()
  await expect(page.getByLabel('Role')).toHaveCount(0)
})
