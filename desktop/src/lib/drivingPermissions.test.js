import { DRIVING, isDrivingPathAllowed } from './drivingPermissions';

const permissions = (codes) => ({
  permissions: new Set(codes),
  moduleAvailable: true,
});

describe('isDrivingPathAllowed', () => {
  it('shows a mapped page only when one of its backend permissions exists', () => {
    expect(isDrivingPathAllowed(
      '/driving/dashboard',
      permissions([DRIVING.dashboardView]),
    )).toBe(true);
    expect(isDrivingPathAllowed(
      '/driving/dashboard',
      permissions([DRIVING.studentView]),
    )).toBe(false);
  });

  it('fails closed for an unmapped driving-school route', () => {
    expect(isDrivingPathAllowed(
      '/driving/future-sensitive-page',
      permissions([DRIVING.dashboardView]),
    )).toBe(false);
  });

  it('does not filter shared non-driving routes', () => {
    expect(isDrivingPathAllowed('/settings', permissions([]))).toBe(true);
  });
});
