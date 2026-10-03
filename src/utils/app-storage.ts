// Project Pages sites on the same github.io host share browser storage.
// Keep preview state separate while preserving existing production keys.
export function scopedStorage(namespace: string, getStorage: () => Storage) {
    const keyFor = (key: string) => namespace ? `${namespace}:${key}` : key;
    return {
        getItem: (key: string) => getStorage().getItem(keyFor(key)),
        setItem: (key: string, value: string) => getStorage().setItem(keyFor(key), value),
        removeItem: (key: string) => getStorage().removeItem(keyFor(key)),
    };
}

export const appStorage = scopedStorage(
    import.meta.env.VITE_STORAGE_NAMESPACE || '',
    () => window.localStorage,
);
