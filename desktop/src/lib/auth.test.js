import { getUserHomePath } from './auth';

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
