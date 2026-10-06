import { describe, it, expect, beforeEach } from 'vitest';
import { LayerLibraryService } from '../../src/services/layer-library.service';
import type { KeyboardInfo } from '../../src/types/keyboard.types';

const IMPORTED_LAYOUTS_KEY = 'keybard-imported-layouts';

describe('LayerLibraryService layout import helpers', () => {
  let service: LayerLibraryService;

  beforeEach(() => {
    localStorage.clear();
    service = new LayerLibraryService();
  });

  it('detects empty and non-empty layers', () => {
    expect(service.isLayerEmpty([0, 1, 0, 1])).toBe(true);
    expect(service.isLayerEmpty([0, 1, 4, 1])).toBe(false);
  });

  it('imports non-empty layers from keyboard info and persists them', () => {
    const kbinfo: KeyboardInfo = {
      rows: 2,
      cols: 2,
      layers: 3,
      keymap: [
        [0, 0, 0, 0], // empty
        [4, 5, 6, 7], // non-empty
        [1, 1, 1, 1], // empty (KC_TRNS)
      ],
      cosmetic: {
        layer: { 1: 'Nav' },
        layer_colors: { 1: 'blue' }
      },
      layer_colors: {
        1: { hue: 10, sat: 20, val: 30 }
      }
    };

    const group = service.importLayoutFromKeyboardInfo(kbinfo, 'Imported Layout');

    expect(group.source).toBe('imported');
    expect(group.name).toBe('Imported Layout');
    expect(group.layers).toHaveLength(1);
    expect(group.layers[0].index).toBe(1);
    expect(group.layers[0].name).toBe('Nav');
    expect(group.layers[0].color).toBe('blue');
    expect(group.layers[0].ledColor).toEqual({ hue: 10, sat: 20, val: 30 });

    const stored = JSON.parse(localStorage.getItem(IMPORTED_LAYOUTS_KEY) || '{}');
    expect(stored.layouts).toHaveLength(1);
    expect(stored.layouts[0].name).toBe('Imported Layout');
  });

  it('deletes imported layouts by id', () => {
    const kbinfo: KeyboardInfo = {
      rows: 1,
      cols: 1,
      layers: 1,
      keymap: [[4]],
    };

    const layout = service.importLayoutFromKeyboardInfo(kbinfo, 'To Delete');
    expect(service.getImportedLayouts()).toHaveLength(1);

    expect(service.deleteImportedLayout(layout.id)).toBe(true);
    expect(service.getImportedLayouts()).toHaveLength(0);
    expect(service.deleteImportedLayout('missing')).toBe(false);
  });

  it('deletes a single imported layer and removes layout when last layer is deleted', () => {
    const kbinfo: KeyboardInfo = {
      rows: 1,
      cols: 2,
      layers: 2,
      keymap: [
        [4, 5],
        [6, 7],
      ],
      cosmetic: {
        layer: { 0: 'Base', 1: 'Nav' }
      }
    };

    const layout = service.importLayoutFromKeyboardInfo(kbinfo, 'Two Layers');
    expect(layout.layers).toHaveLength(2);

    expect(service.deleteImportedLayer(layout.id, 0)).toBe(true);
    let current = service.getImportedLayouts();
    expect(current).toHaveLength(1);
    expect(current[0].layers).toHaveLength(1);
    expect(current[0].layers[0].index).toBe(1);

    expect(service.deleteImportedLayer(layout.id, 1)).toBe(true);
    current = service.getImportedLayouts();
    expect(current).toHaveLength(0);
  });

  it('builds current keyboard group from non-empty layers', () => {
    const keyboard: KeyboardInfo = {
      rows: 2,
      cols: 2,
      name: 'Board Name',
      keymap: [
        [0, 0, 0, 0],
        [4, 5, 6, 7],
      ],
      cosmetic: {
        name: 'Friendly Name',
        layer: { 1: 'Layer One' }
      }
    };

    const group = service.getCurrentKeyboardGroup(keyboard);

    expect(group.id).toBe('current');
    expect(group.source).toBe('current');
    expect(group.name).toBe('Friendly Name');
    expect(group.layers).toHaveLength(1);
    expect(group.layers[0]).toMatchObject({ index: 1, name: 'Layer One' });
  });

  it('converts imported layer to layer entry for clipboard compatibility', () => {
    const entry = service.importedLayerToLayerEntry(
      {
        index: 3,
        name: 'Symbols',
        keymap: [4, 5, 6, 7],
        color: 'teal',
        ledColor: { hue: 1, sat: 2, val: 3 }
      },
      'My Layout'
    );

    expect(entry.name).toBe('Symbols');
    expect(entry.description).toBe('Imported from My Layout');
    expect(entry.sourceLayout).toBe('My Layout');
    expect(entry.keyboardType).toBe('svalboard');
    expect(entry.keyCount).toBe(4);
  });
});
