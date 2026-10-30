// @vitest-environment jsdom
import {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ProjectStatus} from '../src/project-status';

const mock = vi.hoisted(() => ({saveNow: vi.fn()}));
vi.mock('../src/project', () => ({useProject: () => ({
  project: {id: 'one', status: 'draft'}, saveState: 'saved', saveNow: mock.saveNow,
})}));
let root: Root;
let host: HTMLDivElement;
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); mock.saveNow.mockReset();
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
  location.hash = 'projects/one/overview';
  await act(async () => root.render(<ProjectStatus lang="fr" />));
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.useRealTimers();
});
it('keeps the page, prevents duplicate saves and confirms only after success', async () => {
  let finish!: (success: boolean) => void;
  mock.saveNow.mockReturnValue(new Promise<boolean>(resolve => {finish = resolve;}));
  const button = host.querySelector('button')!;
  await act(async () => {button.click(); button.click();});
  expect(mock.saveNow).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  expect(host.querySelector('.sync-spin')).not.toBeNull();
  expect(document.querySelector('.project-save-toast')).toBeNull();
  await act(async () => finish(true));
  expect(host.textContent).toContain('À jour');
  expect(document.querySelector('.project-save-toast')?.textContent).toContain('Modifications enregistrées');
  expect(location.hash).toBe('#projects/one/overview');
  await act(async () => vi.advanceTimersByTime(5000));
  expect(document.querySelector('.project-save-toast')).toBeNull();
});
it('does not report success or navigate when saving fails', async () => {
  mock.saveNow.mockResolvedValue(false);
  await act(async () => host.querySelector('button')!.click());
  expect(document.querySelector('.project-save-toast')).toBeNull();
  expect(host.querySelector('button')!.disabled).toBe(false);
  expect(location.hash).toBe('#projects/one/overview');
});
