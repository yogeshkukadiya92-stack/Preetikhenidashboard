import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('journey diet builder renders new and saved plans with branch services', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { DietPlanModal, DEFAULT_DIET_MEALS } = await server.ssrLoadModule('/src/pages/ClientJourneyPage.jsx');
    for (const saved of [false, true]) {
      const html = renderToStaticMarkup(createElement(DietPlanModal, {
        client: 'Test Patient',
        clientRecord: { clientId: 'P001', name: 'Test Patient' },
        serviceOptions: ['Branch Nutrition Service', 'Follow-up'],
        dietPlanForm: {
          service: 'Branch Nutrition Service', goal: saved ? 'Follow-up nutrition' : '',
          duration: '30 days', planDate: '2026-10-08', weekLabel: 'Phase 1',
          calories: '', water: '', instructions: '',
          meals: DEFAULT_DIET_MEALS.map((meal) => ({ ...meal })),
        },
        saveLabel: saved ? 'Update Diet Plan' : 'Save Diet Plan',
        dietTemplates: [], dietTemplateName: '',
      }));
      assert.match(html, /Diet Plan Builder/);
      assert.match(html, /<option selected="">Branch Nutrition Service<\/option>/);
      assert.match(html, saved ? /Edit Diet Plan/ : /Create Personalized Diet Plan/);
      assert.match(html, /Daily Meal Schedule/);
    }
  } finally {
    await server.close();
  }
});
