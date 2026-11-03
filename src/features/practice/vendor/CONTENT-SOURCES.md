# Additional Keybr content

Code generator, lesson models, word lists and English book data imported from aradzie/keybr.com at 05a37bc5265f65ff538c59c613db29442f345d51.
Source: https://github.com/aradzie/keybr.com/tree/05a37bc5265f65ff538c59c613db29442f345d51

Code and the phonetic models retain the upstream AGPL-3.0 licensing. The locale word lists and models are sourced from `packages/keybr-content-words/lib/data/` and `packages/keybr-phonetic-model/assets/` respectively. Imports are rewritten to local vendored packages; unused bindings may be removed for TypeScript checks. Books are the upstream public-domain English editions (Alice in Wonderland, The Call of the Wild, and Jekyll and Hyde).

Also restored the upstream BooksLesson and custom-text examples. BooksLesson uses host-supplied book metadata; its selection and generation logic are retained. PracticeCodeLesson invokes the upstream Syntax generator with the same flags.
