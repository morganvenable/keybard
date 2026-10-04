import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerLibraryService } from '../../src/services/layer-library.service';
import type { LayerDatabase, LayerEntry } from '../../src/types/layer-library';

const STORAGE_KEY = 'keybard-layer-library';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeLayer(overrides: Partial<LayerEntry> = {}): LayerEntry {
  return {
    id: 'abc123',
    name: 'Default Layer',
    description: 'Default description',
    author: 'tester',
    tags: ['default'],
    keyboardType: 'svalboard',
    keyCount: 4,
    keymap: [0, 0, 0, 0],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('LayerLibraryService', () => {
  let service: LayerLibraryService;

  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    service = new LayerLibraryService();
  });

  it('loads bundled layers and user layers (user first)', async () => {
    const bundled = makeLayer({ id: 'bundled1', name: 'Bundled' });
    const user = makeLayer({ id: 'user1', name: 'User Layer' });

    const db: LayerDatabase = { version: 1, layers: [bundled] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => db });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([user]));

    const layers = await service.loadLayers();

    expect(mockFetch).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}layer-library/layers.json`);
    expect(layers).toHaveLength(2);
    expect(layers[0].id).toBe('user1');
    expect(layers[1].id).toBe('bundled1');
  });

  it('searches layers by query, tags, keyboard type, and sort order', async () => {
    const db: LayerDatabase = {
      version: 1,
      layers: [
        makeLayer({
          id: 'g1',
          name: 'Gaming',
          description: 'WASD layout',
          author: 'alice',
          tags: ['gaming'],
          keyboardType: 'svalboard',
          updatedAt: '2026-01-03T00:00:00Z'
        }),
        makeLayer({
          id: 'v1',
          name: 'Vim Nav',
          description: 'hjkl',
          author: 'bob',
          tags: ['vim', 'programming'],
          keyboardType: 'svalboard',
          updatedAt: '2026-01-02T00:00:00Z'
        }),
        makeLayer({
          id: 'm1',
          name: 'Music',
          description: 'MIDI layer',
          author: 'charlie',
          tags: ['music'],
          keyboardType: 'other',
          updatedAt: '2026-01-01T00:00:00Z'
        })
      ]
    };

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => db });

    const byQuery = await service.searchLayers({ query: 'vim' });
    expect(byQuery.layers.map(l => l.id)).toEqual(['v1']);

    const byTag = await service.searchLayers({ tags: ['gaming'] });
    expect(byTag.layers.map(l => l.id)).toEqual(['g1']);

    const byKeyboard = await service.searchLayers({ keyboardType: 'svalboard', sortBy: 'recent' });
    expect(byKeyboard.layers.map(l => l.id)).toEqual(['g1', 'v1']);

    const byName = await service.searchLayers({ keyboardType: 'svalboard', sortBy: 'name' });
    expect(byName.layers.map(l => l.id)).toEqual(['g1', 'v1']);
  });

  it('adds, fetches, and deletes user layers', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ version: 1, layers: [] }) });

    const userLayer = makeLayer({ id: 'user2', name: 'My Layer' });
    await service.addLayer(userLayer);

    const fetched = await service.getLayerById('user2');
    expect(fetched?.name).toBe('My Layer');

    expect(await service.deleteLayer('user2')).toBe(true);
    expect(await service.getLayerById('user2')).toBeNull();
  });

  it('returns sorted unique tags across all layers', async () => {
    const db: LayerDatabase = {
      version: 1,
      layers: [
        makeLayer({ id: 'a', tags: ['vim', 'coding'] }),
        makeLayer({ id: 'b', tags: ['gaming', 'vim'] })
      ]
    };

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => db });

    const tags = await service.getAllTags();

    expect(tags).toEqual(['coding', 'gaming', 'vim']);
  });

  it('clears cache and refetches bundled layers', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ version: 1, layers: [] }) });

    await service.loadLayers();
    await service.loadLayers();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    service.clearCache();
    await service.loadLayers();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('generates 6-character IDs', () => {
    const id = service.generateId();
    expect(id).toMatch(/^[a-z0-9]{6}$/);
  });
});
