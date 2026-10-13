import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { check } from '@tauri-apps/plugin-updater';
import { DesktopUpdater } from './DesktopUpdater';

jest.mock('@tauri-apps/plugin-updater', () => ({ check: jest.fn() }));
jest.mock('@tauri-apps/plugin-process', () => ({ relaunch: jest.fn() }));

let root: Root;
let host: HTMLDivElement;
const originalChannel = process.env.REACT_APP_DISTRIBUTION_CHANNEL;
const originalTauri = window.__TAURI__;
const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;

beforeEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  jest.clearAllMocks();
  (check as jest.Mock).mockResolvedValue(null);
  Object.defineProperty(window, '__TAURI__', { configurable: true, value: {} });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.useRealTimers();
  if (originalChannel === undefined) delete process.env.REACT_APP_DISTRIBUTION_CHANNEL;
  else process.env.REACT_APP_DISTRIBUTION_CHANNEL = originalChannel;
  Object.defineProperty(window, '__TAURI__', { configurable: true, value: originalTauri });
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
});

test('Mac App Store build never contacts the external updater', async () => {
  process.env.REACT_APP_DISTRIBUTION_CHANNEL = 'mac-app-store';
  await act(async () => {
    root.render(<DesktopUpdater />);
  });
  await act(async () => { jest.advanceTimersByTime(30_000); });
  expect(check).not.toHaveBeenCalled();
  expect(host.innerHTML).toBe('');
});

test('direct desktop distribution keeps its update check', async () => {
  delete process.env.REACT_APP_DISTRIBUTION_CHANNEL;
  await act(async () => { root.render(<DesktopUpdater />); });
  await act(async () => { jest.advanceTimersByTime(1_500); });
  expect(check).toHaveBeenCalledTimes(1);
});
