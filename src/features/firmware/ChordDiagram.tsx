import { handName, type Hand } from "@/services/updater/protocol";

/**
 * The confirmation keys, by position only: the firmware reads Index South and Middle South
 * on the half with USB (svalboard/qmk keyboards/svalboard/config.h, SVAL_UPDATE_CHORD_ROW_A/B
 * and SVAL_UPDATE_CHORD_COL: local rows 1 and 2, column 0). Never their legends: the layout
 * on the board can put anything on those keys, and a blank board has none.
 */
export const CHORD_KEY_NAMES = ["index south", "middle south"] as const;

/** "the south keys of your index and middle fingers": the chord in a sentence. */
export const CHORD_KEYS_PHRASE = "the south keys of your index and middle fingers";

/**
 * The half with USB, drawn as its four finger clusters, with the two keys to press lit:
 * Index South and Middle South. The lit keys carry no letters.
 */
export function ChordDiagram({ hand }: { hand: Hand }) {
    // Clusters from the thumb side outward: index, middle, ring, pinky.
    const order = hand === 1 ? [0, 1, 2, 3] : [3, 2, 1, 0];
    const key = "rounded-sm border border-kb-gray-border";
    return (
        <div className="flex items-end justify-center gap-2.5 py-1" role="img" data-testid="chord-diagram"
            aria-label={`${handName(hand)} half: ${CHORD_KEY_NAMES[0]} and ${CHORD_KEY_NAMES[1]} lit`}>
            {order.map((finger) => {
                const lit = finger === 0 || finger === 1;
                return (
                    <div key={finger} className="grid grid-cols-3 grid-rows-3 gap-0.5" style={{ width: 54, height: 54 }} data-finger={["index", "middle", "ring", "pinky"][finger]}>
                        <span />
                        <span className={key} />
                        <span />
                        <span className={key} />
                        <span className={key} />
                        <span className={key} />
                        <span />
                        <span className={lit ? "rounded-sm bg-kb-confirm" : key} data-chord-key={lit ? CHORD_KEY_NAMES[finger] : undefined} />
                        <span />
                    </div>
                );
            })}
        </div>
    );
}
