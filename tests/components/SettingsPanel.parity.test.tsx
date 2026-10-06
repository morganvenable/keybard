import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsPanel from '../../src/layout/SecondarySidebar/Panels/SettingsPanel';
const state = vi.hoisted(() => ({ mode: 'sidebar', navigate: vi.fn(), update: vi.fn(), setInstant: vi.fn(async () => true) }));
vi.mock('@/contexts/KeyboardContext', () => ({ useKeyboard: () => ({ keyboard: null }) }));
vi.mock('@/contexts/ChangesContext', () => ({ useChanges: () => ({ setInstant: state.setInstant }) }));
vi.mock('@/contexts/LayoutSettingsContext', () => ({ useLayoutSettings: () => ({ layoutMode: state.mode }) }));
vi.mock('@/contexts/PanelsContext', () => ({ usePanels: () => ({ setActivePanel: state.navigate }) }));
vi.mock('@/App', () => ({ useNavigation: () => ({ navigateTo: vi.fn() }) }));
vi.mock('@/hooks/useLayoutImport', () => ({ useLayoutImport: () => ({}) }));
vi.mock('@/contexts/SettingsContext', () => ({ useSettings: () => ({
 getSetting: (_name: string, fallback: unknown) => fallback, updateSetting: state.update,
 settingsDefinitions: [
  {name: 'qmk', label: 'QMK Settings', description: 'Configure firmware behavior.', type: 'action', action: 'open-qmk-settings'},
  {name: 'typing-binds-key', label: 'Typing assigns a key', description: 'Explicit key recording.', type: 'boolean', defaultValue: false},
  {name: 'scan', label: 'Scan Lab', type: 'action', action: 'open-scan-lab'},
 ],
 settingsCategories: [
  {name: 'general', label: 'General', settings: ['qmk', 'typing-binds-key']},
  {name: 'fragments', label: 'Hardware', settings: []},
  {name: 'developer', label: 'Developer', settings: ['scan']},
 ],
}) }));
vi.mock('../../src/layout/SecondarySidebar/Panels/BoardIdentitySection', () => ({ default: () => <p>Board identity</p> }));
vi.mock('../../src/layout/SecondarySidebar/Panels/FragmentsPanel', () => ({ default: () => <p>Hardware selections</p> }));
vi.mock('../../src/layout/SecondarySidebar/Panels/DynamicMenuPanel', () => ({ default: () => null }));
describe('settings placement parity', () => {
 it('gives actions concise names and associates help with named controls', () => {
  render(<SettingsPanel />);
  expect(screen.getByRole('button', {name: 'QMK Settings'})).toHaveAttribute('aria-description', 'Configure firmware behavior.');
  expect(screen.getByRole('group', {name: 'Typing assigns a key'})).toHaveAttribute('aria-description', 'Explicit key recording.');
 });
 it.each(['sidebar', 'bottombar'])('retains all settings destinations in %s mode', mode => {
  state.mode = mode;
  render(<SettingsPanel />);
  expect(screen.getByText('Board identity')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name: /QMK Settings/}));
  expect(state.navigate).toHaveBeenCalledWith('qmksettings');
  fireEvent.click(screen.getByRole('button', {name: 'Hardware'}));
  expect(screen.getByText('Hardware selections')).toBeVisible();
  fireEvent.click(screen.getByRole('button', {name: 'Developer'}));
  fireEvent.click(screen.getByRole('button', {name: /Scan Lab/}));
  expect(state.navigate).toHaveBeenCalledWith('scanlab');
 });
 it('keeps the active settings category on placement changes', () => {
  state.mode = 'sidebar';
  const view = render(<SettingsPanel />);
  fireEvent.click(screen.getByRole('button', {name: 'Developer'}));
  state.mode = 'bottombar';
  view.rerender(<SettingsPanel />);
  expect(screen.getByRole('button', {name: 'Developer'})).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', {name: /Scan Lab/})).toBeVisible();
 });
});
