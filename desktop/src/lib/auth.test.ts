import {
  createDesktopUser,
  getUserHomePath,
  loginWithBackend,
} from './auth';
import { getDesktopApiCandidates } from './appEnv';

describe('getUserHomePath', () => {
  it('keeps a regular school admin on the school dashboard', () => {
    expect(getUserHomePath({
      role: 'admin',
      institutionType: 'PrivateSchool',
    })).toBe('/dashboard');
  });
});

describe('createDesktopUser', () => {
  it('ignores the legacy driving-school flag and keeps admins on the school dashboard', () => {
    const user = createDesktopUser({
      user: {
        id: 'owner-1',
        primaryRole: 'Admin',
        institutionType: 'PrivateSchool',
        drivingSchoolModuleEnabled: true,
      },
    });

    expect(user.institutionType).toBe('PrivateSchool');
    expect(user.homePath).toBe('/dashboard');
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
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://maydanozasist.schoolasist.com/api/auth/login');
  });

  it('tells a moved driving-school user to use DrivingAsist', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      code: 'INSTITUTION_MOVED',
      message: 'Kurumunuz artık DrivingAsist uygulamasını kullanıyor.',
    }), { status: 403 }));

    await expect(loginWithBackend('kurs.admin', 'Parola123')).rejects.toMatchObject({
      code: 'INSTITUTION_MOVED',
      message: expect.stringContaining('DrivingAsist'),
    });
  });
});
