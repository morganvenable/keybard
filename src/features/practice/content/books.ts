export const BOOKS = [
    { id: 'alice', title: "Alice in Wonderland", author: 'Lewis Carroll' },
    { id: 'wild', title: 'The Call of the Wild', author: 'Jack London' },
    { id: 'jekyll', title: 'Jekyll and Hyde', author: 'Robert Louis Stevenson' },
] as const;
export type BookTexts = Record<string, readonly string[]>;
export async function loadBooks(): Promise<BookTexts> {
    const modules = await Promise.all([import('./assets/en-alice-wonderland.json'), import('./assets/en-call-wild.json'), import('./assets/en-jekyll-hyde.json')]);
    return Object.fromEntries(modules.map((module, i) => [BOOKS[i].id, module.default.flatMap((chapter) => chapter[1] as string[])]));
}
