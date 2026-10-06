// Print service - generate printable keyboard layout views
import type { KeyboardInfo } from '../types/keyboard.types';
import { keyService } from './key.service';

// KC_NO = 0x0000, KC_TRNS = 0x0001
const KC_NO = 0x0000;
const KC_TRNS = 0x0001;

export interface PrintableLayer {
  index: number;
  name: string;
  keymap: number[];
}

export class PrintService {
  /**
   * Check if a layer contains any meaningful keycodes (not KC_NO or KC_TRNS)
   */
  isLayerNonEmpty(layerKeymap: number[]): boolean {
    return layerKeymap.some(keycode => keycode !== KC_NO && keycode !== KC_TRNS);
  }

  /**
   * Get all non-empty layers from keyboard info
   */
  getNonEmptyLayers(keyboard: KeyboardInfo): PrintableLayer[] {
    const layers: PrintableLayer[] = [];

    if (!keyboard.keymap) {
      return layers;
    }

    for (let i = 0; i < keyboard.keymap.length; i++) {
      const layerKeymap = keyboard.keymap[i];
      if (this.isLayerNonEmpty(layerKeymap)) {
        // Get layer name from cosmetic data if available
        const layerName = keyboard.cosmetic?.layer?.[i.toString()] || `Layer ${i}`;
        layers.push({
          index: i,
          name: layerName,
          keymap: layerKeymap,
        });
      }
    }

    return layers;
  }

  /**
   * Convert a keycode to display string
   */
  getKeycodeDisplay(keycode: number): { text: string; isEmpty: boolean } {
    if (keycode === KC_NO) {
      return { text: '', isEmpty: true };
    }
    if (keycode === KC_TRNS) {
      return { text: '▽', isEmpty: false }; // Unicode down-pointing triangle for transparent
    }

    const keyString = keyService.stringify(keycode);
    // Simplify common keycodes for display
    let displayText = keyString
      .replace(/^KC_/, '')
      .replace(/^LCTL\(/, 'C-')
      .replace(/^LSFT\(/, 'S-')
      .replace(/^LALT\(/, 'A-')
      .replace(/^LGUI\(/, 'G-')
      .replace(/^RCTL\(/, 'RC-')
      .replace(/^RSFT\(/, 'RS-')
      .replace(/^RALT\(/, 'RA-')
      .replace(/^RGUI\(/, 'RG-')
      .replace(/\)$/, '');

    return { text: displayText, isEmpty: false };
  }

  /**
   * Trigger browser print dialog
   */
  triggerPrint(): void {
    window.print();
  }
}

// Export singleton instance
export const printService = new PrintService();
