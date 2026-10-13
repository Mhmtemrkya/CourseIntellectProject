import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { changePassword } from '../lib/api/modules';
import { clearDesktopSession } from '../lib/auth';
import ForcePasswordChange from './ForcePasswordChange';

const mockNavigate = jest.fn();
const mockToast = jest.fn();
const mockSetUser = jest.fn();
const mockSetSession = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../context/AppContext', () => ({ useApp: () => ({ setUser: mockSetUser, setSession: mockSetSession }) }));
jest.mock('../hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock('../lib/api/modules', () => ({ changePassword: jest.fn() }));
jest.mock('../lib/auth', () => ({ clearDesktopSession: jest.fn() }));

let root: Root;
let host: HTMLDivElement;
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  (changePassword as jest.Mock).mockResolvedValue(null);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<ForcePasswordChange />));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
});

function fill(id: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
  act(() => { input.value = value; Simulate.change(input); });
}

function fillNewPassword() {
  fill('new-password', 'NewExample2026!');
  fill('confirm-password', 'NewExample2026!');
}

test('valid new passwords cannot submit without the temporary credential', async () => {
  fillNewPassword();
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  await act(async () => Simulate.submit(host.querySelector('form')!));
  expect(changePassword).not.toHaveBeenCalled();
});

test('first-login password change proves the current credential and returns to login', async () => {
  fill('temporary-password', 'TemporaryExample1');
  fillNewPassword();
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  await act(async () => Simulate.submit(host.querySelector('form')!));
  expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'TemporaryExample1', newPassword: 'NewExample2026!' });
  expect(clearDesktopSession).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
});

test('a rejected temporary credential leaves the session available for correction', async () => {
  (changePassword as jest.Mock).mockRejectedValueOnce(new Error('Mevcut şifre hatalı.'));
  fill('temporary-password', 'WrongExample1');
  fillNewPassword();
  await act(async () => Simulate.submit(host.querySelector('form')!));
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hata', description: 'Mevcut şifre hatalı.' }));
  expect(clearDesktopSession).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
