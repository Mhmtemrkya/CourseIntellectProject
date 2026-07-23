import { createDesktopUser, getUserHomePath, resolveUserInstitutionType } from './auth';

describe('getUserHomePath', () => {
  it('sends an enabled driving-school user to the permission-aware driving entry', () => {
    expect(getUserHomePath({
      role: 'admin',
      institutionType: 'DrivingSchool',
      drivingSchoolModuleEnabled: true,
    })).toBe('/driving');
  });

  it('keeps a regular school admin on the school dashboard', () => {
    expect(getUserHomePath({
      role: 'admin',
      institutionType: 'PrivateSchool',
    })).toBe('/dashboard');
  });
});

describe('resolveUserInstitutionType', () => {
  it('uses the explicit institution type when the API provides it', () => {
    expect(resolveUserInstitutionType({
      institutionType: 'PrivateSchool',
      drivingSchoolModuleEnabled: true,
    })).toBe('PrivateSchool');
  });

  it('recovers legacy driving-school sessions from the module flag', () => {
    expect(resolveUserInstitutionType({
      drivingSchoolModuleEnabled: true,
    })).toBe('DrivingSchool');
  });

  it('creates a driving-school desktop user even when an old API omits institutionType', () => {
    const user = createDesktopUser({
      user: {
        id: 'owner-1',
        primaryRole: 'Admin',
        drivingSchoolModuleEnabled: true,
      },
    });

    expect(user.institutionType).toBe('DrivingSchool');
    expect(user.homePath).toBe('/driving');
  });
});
