import { test, expect } from '@playwright/test';

test('imports and studies an ordered illustrated problem bank without Gemini', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Import problem bank', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import a permanent problem bank' });
  await expect(dialog.getByText(/No Gemini request is made/)).toBeVisible();
  const sourceDiagram = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwVdWQAAAABJRU5ErkJggg==';
  const bank = {
    version: 1, name: 'Offline HGE Bank', spex: 'C', set: 9,
    questions: [{
      title: 'Imported discharge problem', topic: 'Hydraulics',
      prompt: 'A channel carries 42 m3/s. State the discharge.', answer: 42, unit: 'm3/s', tolerance: 0.01,
      steps: [{ text: 'The requested discharge is stated directly.', latex: 'Q=42\\ \\mathrm{m^3/s}' }],
      diagramImage: { data: sourceDiagram, alt: 'Original channel diagram', caption: 'Shared source figure.' },
    }, {
      title: 'Follow-up velocity problem', topic: 'Hydraulics',
      prompt: 'Using the same source figure, state the velocity.', answer: 3, unit: 'm/s', tolerance: 0.01,
      steps: [{ text: 'The requested velocity is stated directly.', latex: 'v=3\\ \\mathrm{m/s}' }],
      diagramImage: { data: sourceDiagram, alt: 'Original channel diagram', caption: 'Shared source figure.' },
    }, {
      title: 'Follow-up depth problem', topic: 'Hydraulics',
      prompt: 'Using the same source figure, state the water depth.', answer: 2, unit: 'm', tolerance: 0.01,
      steps: [{ text: 'The requested depth is stated directly.', latex: 'y=2\\ \\mathrm{m}' }],
      diagramImage: { data: sourceDiagram, alt: 'Original channel diagram', caption: 'Shared source figure.' },
    }],
  };
  await dialog.locator('input[type=file]').setInputFiles({ name: 'offline-bank.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bank)) });
  await dialog.getByRole('button', { name: 'Import problem bank', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Imported discharge problem' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate new questions', exact: true }).click();
  const generator = page.getByRole('dialog', { name: 'Create a practice set' });
  await expect(generator.getByLabel('Question source').locator('option[value="variant"]')).toHaveText(/Offline variations/);
  await generator.getByLabel('Question source').selectOption('bank');
  await generator.getByLabel('Examination').selectOption('C');
  await expect(generator.getByLabel('Set 9')).toBeChecked();
  await generator.getByLabel('Number of questions').selectOption('3');
  await generator.getByRole('button', { name: 'Choose random questions', exact: true }).click();
  await expect(generator).toHaveCount(0);
  await page.getByRole('button', { name: /SPEX C/ }).last().click();
  await page.getByLabel('Filter by set').selectOption('9');
  await expect(page.getByRole('heading', { name: 'Hydraulics' })).toBeVisible();
  await expect(page.getByText(/A channel carries 42 m³\/s/)).toBeVisible();
  await expect(page.getByText('Permanent problem bank · no Gemini usage')).toBeVisible();
  await expect(page.locator('.source-diagram img')).toHaveAttribute('alt', 'Original channel diagram');
  await expect(page.locator('.question-list>button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Generate new questions', exact: true }).click();
  const replaceDialog = page.getByRole('dialog', { name: 'Replace the current practice set?' });
  await expect(replaceDialog).toBeVisible();
  await replaceDialog.getByRole('button', { name: 'Keep current set', exact: true }).click();
  await expect(page.locator('.question-list>button')).toHaveCount(3);
  await page.getByLabel('Your answer').fill('42');
  await page.getByRole('button', { name: 'Check answer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'You got it.' })).toBeVisible();
  await expect(page.getByLabel('Your answer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next problem', exact: false }).click();
  await expect(page.getByText(/state the velocity/)).toBeVisible();
  await expect(page.locator('.source-diagram img')).toHaveAttribute('alt', 'Original channel diagram');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByText(/A channel carries 42/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You got it.' })).toBeVisible();
  await expect(page.getByLabel('Your answer')).toHaveCount(0);

  await page.getByRole('button', { name: 'Study Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hydraulics', exact: true })).toBeVisible();
  await expect(page.getByText('SAMPLE PROBLEMS', { exact: true })).toBeVisible();
  await expect(page.locator('.guide-example')).toHaveCount(3);
  await expect(page.locator('.guide-example .source-diagram img').first()).toHaveAttribute('alt', 'Original channel diagram');
  await page.locator('.guide-example').first().getByRole('button', { name: 'Open in Practice', exact: true }).click();
  const sampleDialog = page.getByRole('dialog', { name: 'Open this sample in Practice?' });
  await expect(sampleDialog).toBeVisible();
  await sampleDialog.getByRole('button', { name: 'Open sample problem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hydraulics', exact: true })).toBeVisible();
  await expect(page.locator('.question-list>button')).toHaveCount(1);
  await expect(page.locator('.source-diagram img')).toHaveAttribute('alt', 'Original channel diagram');
  expect(errors).toEqual([]);
});
