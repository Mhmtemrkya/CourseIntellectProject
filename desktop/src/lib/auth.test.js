import {
  createDesktopUser,
  getUserHomePath,
  loginWithBackend,
  resolveUserInstitutionType,
} from './auth';
import { getDesktopApiCandidates } from './appEnv';

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

describe('production API resilience', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses only the SchoolAsist production API origin', () => {
    expect(getDesktopApiCandidates()).toEqual([
      'https://maydanozasist.schoolasist.com',
    ]);
  });

  it('does not fall back to a retired API when the connection fails', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new TypeError('network unavailable'));

    await expect(loginWithBackend('test@example.com', 'invalid-password'))
      .rejects.toThrow('Giriş sunucusuna bağlantı kurulamadı');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://maydanozasist.schoolasist.com/api/auth/login');
  });
});
