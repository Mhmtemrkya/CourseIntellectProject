import { isModuleAllowed } from './entitlements';

const entitlements = {
  unrestricted: false,
  roles: {
    admin: {
      modules: {
        dashboard: { enabled: false },
      },
    },
  },
};

describe('isModuleAllowed', () => {
  it('continues to deny an explicitly disabled module', () => {
    expect(isModuleAllowed(entitlements, 'admin', 'dashboard')).toBe(false);
  });

  it('allows a module added after an existing package definition', () => {
    expect(isModuleAllowed(entitlements, 'admin', 'driving-school')).toBe(true);
  });
});
