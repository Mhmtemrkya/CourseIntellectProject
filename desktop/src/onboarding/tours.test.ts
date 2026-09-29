import { findPageTour, findWelcomeTour } from './tours';

describe('onboarding tour catalog', () => {
  test('known pages include detailed workflow, controls and safety cards', () => {
    const tour = findPageTour('/finance/installments', ['finance']);

    expect(tour.id).toBe('page:v3:/finance/installments');
    expect(tour.steps.length).toBeGreaterThanOrEqual(5);
    expect(tour.steps.some((step) => step.title.includes('iş akışı'))).toBe(true);
    expect(tour.steps.some((step) => step.title.includes('Güvenli'))).toBe(true);
    expect(tour.steps.at(-1).body).toContain('Muhasebe');
  });

  test('every application route receives a safe role-aware fallback tour', () => {
    const tour = findPageTour('/new-module/example-detail', ['teacher']);

    expect(tour).not.toBeNull();
    expect(tour.steps.length).toBeGreaterThanOrEqual(5);
    expect(tour.steps.at(-1).body).toContain('Öğretmen');
  });

  test('institution owner welcome tour explains branch-first setup', () => {
    const tour = findWelcomeTour(['admin']);
    const allText = tour.steps.map((step) => `${step.title} ${step.body}`).join(' ');

    expect(tour.id).toBe('welcome:admin:v2');
    expect(allText).toContain('Şubeyi');
    expect(allText).toContain('Kayıt Geçmişi');
  });

  test('branch managers use the detailed institution tour', () => {
    expect(findWelcomeTour(['branchmanager']).id).toBe('welcome:admin:v2');
  });
});
