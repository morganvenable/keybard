import type { FolderDirectoryHandle, FolderFileHandle, FolderPermission } from '../../../src/services/backup/folder';

const domError = (name: string) => Object.assign(new Error(name), { name });

/** An in-memory FileSystemDirectoryHandle stand-in. */
export class FakeDirectory implements FolderDirectoryHandle {
    files = new Map<string, string>();
    dirs = new Map<string, FakeDirectory>();
    permission: FolderPermission = 'granted';
    /** What requestPermission answers (as if the user clicked). */
    grantOnRequest: FolderPermission = 'granted';
    gone = false;
    requests = 0;

    constructor(public name: string, private root?: FakeDirectory) {}

    private check() {
        const top = this.root ?? this;
        if (top.gone) throw domError('NotFoundError');
        if (top.permission !== 'granted') throw domError('NotAllowedError');
    }

    async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDirectory> {
        this.check();
        let dir = this.dirs.get(name);
        if (!dir) {
            if (!options?.create) throw domError('NotFoundError');
            dir = new FakeDirectory(name, this.root ?? this);
            this.dirs.set(name, dir);
        }
        return dir;
    }

    async getFileHandle(name: string, options?: { create?: boolean }): Promise<FolderFileHandle> {
        this.check();
        if (!this.files.has(name) && !options?.create) throw domError('NotFoundError');
        return {
            createWritable: async () => {
                let buffer = '';
                return {
                    write: async (data: string) => { buffer += data; },
                    close: async () => { this.check(); this.files.set(name, buffer); },
                };
            },
        };
    }

    async removeEntry(name: string): Promise<void> {
        this.check();
        if (!this.files.delete(name)) throw domError('NotFoundError');
    }

    async queryPermission(): Promise<FolderPermission> {
        return this.permission;
    }

    async requestPermission(): Promise<FolderPermission> {
        this.requests++;
        this.permission = this.grantOnRequest;
        return this.permission;
    }
}
