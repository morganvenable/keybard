import { exampleTexts } from '../content/examples';
import { flattenStyledText } from '../vendor/keybr/textinput/index.ts';
import { useState } from 'react';
import type { PracticeController } from '../state/controller';
import { BOOKS } from '../content/books';
import { Syntax } from '../vendor/keybr/code/index.ts';
import { syntaxFor } from '../lessons/content';
import { PracticeWordsLesson } from '../lessons/words';
import { CustomTextDialog } from './CustomTextDialog';
import { DRILL_GROUPS, type DrillGroup, type DrillHands } from '../state/settings';
import { drillGroupLabel } from '../lessons/scope';
import { boardDirections } from './TypeSections';
import { untypeableChars } from '../lessons/custom';

export function ContentChooser({ controller: c, onMore }: { controller: PracticeController; onMore: () => void }) {
    const [editing, setEditing] = useState(false);
    const s = c.settings;
    const session = c.session;
    if (s.type === 'guided' || !session || session.firstRun) return null;
    const lesson = session.lesson;
    const words = lesson instanceof PracticeWordsLesson ? [...lesson.wordList] : [];
    const paragraphs = session.content.books?.[s.book] ?? [];
    const syntax = syntaxFor(s.syntax);
    const scope = session.lessonKeys.findIncludedKeys().map(k => String.fromCodePoint(k.letter.codePoint)).join(' ');
    const codePreview = c.run ? flattenStyledText(c.run.textInput.text) : '';
    const missing = s.type === 'code' ? untypeableChars(codePreview, session.resolution) : [];
    return <section className="svalbr-content" aria-label="Practice content">
        <div className="svalbr-content-controls">
            {s.type === 'words' && <>
                <label>Common words<select aria-label="Vocabulary size" value={s.words.size} onChange={e => c.update({ words: { ...s.words, size: Number(e.target.value) } })}>
                    {[...new Set([50, 100, 200, 500, 1000, s.words.size])].sort((a,b) => a-b).map(n => <option key={n} value={n}>{n} words</option>)}
                </select></label>
                <label><input type="checkbox" checked={s.words.longOnly} onChange={e => c.update({ words: { ...s.words, longOnly: e.target.checked } })} />Long words only</label>
            </>}
            {s.type === 'books' && <>
                <label>Book<select aria-label="Book" value={s.book} onChange={e => c.update({ book: e.target.value, paragraph: 0 })}>{BOOKS.map(b => <option key={b.id} value={b.id}>{b.title} - {b.author}</option>)}</select></label>
                <label>Paragraph<select aria-label="Paragraph" value={Math.min(s.paragraph, Math.max(0, paragraphs.length - 1))} onChange={e => c.update({ paragraph: Number(e.target.value) })}>{paragraphs.map((p,i) => <option key={i} value={i}>{i+1}. {p.slice(0,55)}</option>)}</select></label>
                <label><input type="checkbox" checked={s.bookLowercase} onChange={e => c.update({ bookLowercase: e.target.checked })} />Lowercase</label>
                <label><input type="checkbox" checked={s.bookLettersOnly} onChange={e => c.update({ bookLettersOnly: e.target.checked })} />Letters only</label>
            </>}
            {s.type === 'code' && <>
                <label>Language<select aria-label="Language" value={syntax.id} onChange={e => c.update({ syntax: e.target.value })}>{[...Syntax.ALL].map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                {[...syntax.flags].map(flag => <label key={flag}><input type="checkbox" checked={s.codeFlags.includes(flag)} onChange={e => c.update({ codeFlags: e.target.checked ? [...s.codeFlags, flag] : s.codeFlags.filter(f => f !== flag) })} />{flag}</label>)}
            </>}
            {s.type === 'numbers' && <label><input type="checkbox" checked={s.numbersBenford} onChange={e => c.update({ numbersBenford: e.target.checked })} />Natural number frequency (Benford)</label>}
            {s.type === 'drill' && <>
                <label>Group<select aria-label="Group" value={s.drill.group} onChange={e => c.updateDrill({ group: e.target.value as DrillGroup })}>{DRILL_GROUPS.map(g => <option key={g} value={g}>{drillGroupLabel(g)}</option>)}</select></label>
                <label>Hand<select aria-label="Hand" value={s.drill.hands} onChange={e => c.updateDrill({ hands: e.target.value as DrillHands })}><option value="both">Both</option><option value="left">Left</option><option value="right">Right</option></select></label>
                <label>Layer<select aria-label="Layer" value={s.drill.layer ?? 'all'} onChange={e => c.updateDrill({ layer: e.target.value === 'all' ? null : Number(e.target.value) })}><option value="all">All</option>{[...session.resolution.layers.keys()].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                <div className="svalbr-content-directions" role="group" aria-label="Cluster directions">{boardDirections(c).map(dir => <button key={dir} type="button" aria-pressed={s.drill.dirs.includes(dir)} onClick={() => c.updateDrill({ dirs: s.drill.dirs.includes(dir) ? s.drill.dirs.filter(d => d !== dir) : [...s.drill.dirs, dir] })}>{dir}</button>)}</div>
            </>}
            {s.type === 'custom' && <>
                <label>Example<select aria-label="Text example" value={exampleTexts.findIndex(t => t.content === s.customText.content)} onChange={e => { const text = exampleTexts[Number(e.target.value)]; if (text) c.update({ customText: { ...s.customText, content: text.content } }); }}><option value={-1} disabled>Your text</option>{exampleTexts.map((text,i) => <option key={text.title} value={i}>{text.title}</option>)}</select></label>
                <button type="button" onClick={() => setEditing(true)}>Paste or edit text</button>
                {(['lowercase', 'lettersOnly', 'randomize'] as const).map((key,i) => <label key={key}><input type="checkbox" checked={s.customText[key]} onChange={e => c.update({ customText: { ...s.customText, [key]: e.target.checked } })} />{['Lowercase', 'Letters only', 'Shuffle words'][i]}</label>)}
            </>}
            <button className="svalbr-content-more" type="button" onClick={onMore}>More options</button>
        </div>
        {s.type === 'words' && <details><summary>Vocabulary: {words.length} words</summary><p className="svalbr-content-preview">{words.join(' / ')}</p></details>}
        {s.type === 'drill' && <p className="svalbr-content-scope">In scope: {scope || 'No matching characters'}</p>}
        {s.type === 'books' && <details><summary>Passage preview</summary><p className="svalbr-content-preview">{paragraphs[s.paragraph]}</p></details>}
        {missing.length > 0 && <p className="svalbr-content-scope">Not on this keymap: {missing.map(cp => String.fromCodePoint(cp)).join(' ')}. Choose a keymap that includes these characters.</p>}
        {s.type === 'code' && <details><summary>Code preview</summary><pre className="svalbr-content-preview">{codePreview}</pre></details>}
        {s.type === 'custom' && <details><summary>Text preview: {s.customText.content.trim().split(/\s+/).filter(Boolean).length} words</summary><p className="svalbr-content-preview">{s.customText.content}</p></details>}
        <CustomTextDialog open={editing} onOpenChange={setEditing} text={s.customText.content} resolution={session.resolution} onUse={content => c.update({ customText: { ...s.customText, content } })} />
    </section>;
}
