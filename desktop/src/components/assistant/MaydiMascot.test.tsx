import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import MaydiMascot from './MaydiMascot';
import MaydiLauncher from './MaydiLauncher';

let root: Root;
let host: HTMLDivElement;
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
const originalActEnvironment: unknown = Reflect.get(globalThis, 'IS_REACT_ACT_ENVIRONMENT');

beforeEach(() => {
  jest.useFakeTimers();
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
  });
  jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.useRealTimers();
  jest.restoreAllMocks();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else Reflect.deleteProperty(window, 'matchMedia');
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', originalActEnvironment);
});

const expression = () => host.querySelector('[data-maydi-state]')?.getAttribute('data-maydi-state');
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

it('plays queued positive feedback after the pending request finishes', () => {
  act(() => root.render(<MaydiMascot thinking affectionSignal={0} />));
  act(() => root.render(<MaydiMascot thinking affectionSignal={1} />));
  expect(expression()).toBe('thinking');
  act(() => root.render(<MaydiMascot thinking={false} affectionSignal={1} responseId="new-response" />));
  expect(expression()).toBe('love');
});

it('keeps an acknowledgement visible when another response arrives', () => {
  act(() => root.render(<MaydiMascot affectionSignal={0} />));
  act(() => root.render(<MaydiMascot affectionSignal={1} />));
  expect(expression()).toBe('love');
  act(() => root.render(<MaydiMascot affectionSignal={1} responseId="new-response" />));
  expect(expression()).toBe('love');
});

it('gives a second positive feedback its own acknowledgement duration', () => {
  act(() => root.render(<MaydiMascot affectionSignal={0} />));
  act(() => root.render(<MaydiMascot affectionSignal={1} />));
  advance(2000);
  act(() => root.render(<MaydiMascot affectionSignal={2} />));
  advance(2500);
  expect(expression()).toBe('love');
  advance(1600);
  expect(expression()).toBe('idle');
});

it('does not replay a saved feedback count when the mascot mounts', () => {
  act(() => root.render(<MaydiMascot affectionSignal={3} />));
  expect(expression()).toBe('idle');
});

function captureImages() {
  const images: HTMLImageElement[] = [];
  jest.spyOn(window, 'Image').mockImplementation(() => {
    const image = document.createElement('img');
    images.push(image);
    return image;
  });
  return () => {
    const spin = images.find((image) => image.src.endsWith('/spin.webp'));
    if (!spin) throw new Error('No turntable preload');
    act(() => { spin.dispatchEvent(new Event('load')); });
  };
}

function finishAnimation() {
  const art = host.querySelector<HTMLElement>('.maydi-mascot__art');
  if (!art) throw new Error('No mascot artwork');
  act(() => Simulate.animationEnd(art));
}

it('plays the first requested turn when its image finishes loading', () => {
  const loadSpin = captureImages();
  act(() => root.render(<MaydiMascot spinSignal={0} />));
  act(() => root.render(<MaydiMascot spinSignal={1} />));
  expect(expression()).toBe('idle');
  loadSpin();
  expect(expression()).toBe('spin');
  finishAnimation();
  expect(expression()).toBe('idle');
});

it('completes a queued entrance with a turn, wink and return to idle', () => {
  const loadSpin = captureImages();
  act(() => root.render(<MaydiMascot platform entranceSignal={0} />));
  act(() => root.render(<MaydiMascot platform entranceSignal={1} />));
  loadSpin();
  expect(expression()).toBe('entrance');
  expect(host.querySelector('.maydi-mascot__platform')).not.toBeNull();
  finishAnimation();
  expect(expression()).toBe('wink');
  finishAnimation();
  expect(expression()).toBe('idle');
});

it('blinks while idle, then returns to normal', () => {
  act(() => root.render(<MaydiMascot />));
  advance(6200);
  expect(expression()).toBe('wink');
  finishAnimation();
  expect(expression()).toBe('idle');
});

it.each([['speaking', 3200], ['happy', 2200], ['guiding', 4200], ['love', 4000]] as const)(
  'presents %s for its full duration, then returns to idle', (mood, duration) => {
    act(() => root.render(<MaydiMascot responseId="old" responseMood={mood} />));
    act(() => root.render(<MaydiMascot responseId="new" responseMood={mood} />));
    expect(expression()).toBe(mood);
    expect(host.querySelector('.maydi-mascot__art')?.getAttribute('style')).toContain(`${mood}-loop.webp`);
    advance(duration - 1);
    expect(expression()).toBe(mood);
    advance(1);
    expect(expression()).toBe('idle');
  },
);

it.each(['idle', 'speaking', 'happy', 'thinking', 'guiding', 'love'] as const)(
  'renders the static %s pose without starting timers', (mood) => {
    act(() => root.render(<MaydiMascot mood={mood} animated={false} />));
    expect(expression()).toBe(mood);
    expect(host.querySelector('.maydi-mascot__art')?.getAttribute('style')).toContain(`${mood}.webp`);
    expect(host.querySelector('.maydi-mascot--animated')).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  },
);

it('spaces page welcomes by 15 seconds and does not replay on chat close', () => {
  const loadSpin = captureImages();
  const renderLauncher = (routeKey: string, visible = true) => act(() => root.render(
    <MaydiLauncher routeKey={routeKey} visible={visible} label="Maydi" onOpen={jest.fn()} />,
  ));
  renderLauncher('/first');
  loadSpin();
  expect(expression()).toBe('entrance');
  finishAnimation();
  finishAnimation();
  renderLauncher('/second');
  expect(expression()).not.toBe('entrance');
  advance(15000);
  renderLauncher('/third');
  expect(expression()).toBe('entrance');
  finishAnimation();
  finishAnimation();
  renderLauncher('/third', false);
  renderLauncher('/third');
  expect(expression()).toBe('idle');
});
