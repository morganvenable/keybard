// QMK Settings service - fetching, parsing, and pushing QMK settings
import { QMK_SETTINGS } from '../constants/qmk-settings';
import type { KeyboardInfo } from '../types/vial.types';
import { SvilUSB, usbInstance } from './usb.service';
import { LE16, LE32 } from './utils';

/**
 * QMK Settings are structured as:
 * - JSON file defines QSIDs (QMK Setting IDs) starting from 1
 * - Each QSID has a width: 1 (byte), 2 (uint16), or 4 (uint32)
 * - We fetch each setting by its QSID individually
 * - First byte returned is the QSID echo (ignored)
 */
export class QMKService {
  private usb: SvilUSB;

  constructor(usb: SvilUSB) {
    this.usb = usb;
  }

  async get(kbinfo: KeyboardInfo): Promise<void> {
    // Get array of QSIDs that the keyboard supports
    // Protocol: Query returns QSIDs > cur, terminated by 0xFFFF
    // Pagination: Track max QSID found, query again until no new QSIDs
    const supported: Record<number, boolean> = {};

    let cur = 0;

    console.log('[QMK] Starting QMK settings query...');

    while (true) {
      // Query for QSIDs > cur (pass as 2-byte little-endian)
      const data = await this.usb.sendSvil(
        SvilUSB.CMD_SVIL_QMK_SETTINGS_QUERY,
        [...LE16(cur)],
        { uint16: true, skipBytes: 1 }
      );

      if (!data) break;

      // data should be a Uint16Array
      const dataArray = Array.isArray(data) ? data : Array.from(data as Iterable<any>);

      let gotAny = false;
      for (const qsid of dataArray) {
        if (qsid === 0xFFFF) break;
        gotAny = true;
        cur = Math.max(cur, qsid);  // Track highest QSID found
        supported[qsid] = true;
      }

      // If no new QSIDs found, we're done
      if (!gotAny) break;
    }

    console.log('[QMK] Supported QSIDs:', Object.keys(supported));

    // Parse out the widths for each QSID value
    // No width = B (byte). Width 2 = H (short). Width 4 = I (int).
    const qsidUnpacks: Record<number, string> = {};
    for (const tab of QMK_SETTINGS.tabs) {
      for (const field of tab.fields) {
        if (field.width === 2) {
          qsidUnpacks[field.qsid] = 'H';
        } else if (field.width === 4) {
          qsidUnpacks[field.qsid] = 'I';
        } else {
          qsidUnpacks[field.qsid] = 'B';
        }
      }
    }

    // Fetch each supported setting
    const settings: Record<number, number> = {};
    console.log('[QMK] Known QSIDs from settings file:', Object.keys(qsidUnpacks));

    for (const qsid of Object.keys(qsidUnpacks)) {
      const qsidNum = parseInt(qsid);
      if (!supported[qsidNum]) {
        console.log('[QMK] Skipping unsupported QSID:', qsidNum);
        continue;
      }

      // First get raw bytes to debug
      const rawResp = await this.usb.sendSvil(
        SvilUSB.CMD_SVIL_QMK_SETTINGS_GET,
        [qsidNum],
        { uint8: true }
      );
      console.log('[QMK] Raw response for QSID', qsidNum, ':', Array.from(rawResp as Uint8Array).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' '));

      // Response format: [cmd_echo:1][status:1][value:width]
      // Parse manually based on width
      const raw = rawResp as Uint8Array;
      let value: number;
      const width = qsidUnpacks[qsidNum] === 'B' ? 1 : qsidUnpacks[qsidNum] === 'H' ? 2 : 4;

      // Skip cmd_echo (1 byte) and status (1 byte) = offset 2
      const valueOffset = 2;
      if (width === 1) {
        value = raw[valueOffset];
      } else if (width === 2) {
        value = raw[valueOffset] | (raw[valueOffset + 1] << 8); // little-endian
      } else {
        value = raw[valueOffset] | (raw[valueOffset + 1] << 8) | (raw[valueOffset + 2] << 16) | (raw[valueOffset + 3] << 24);
      }

      console.log('[QMK] Fetched QSID', qsidNum, '(width', width, ') =', value);
      settings[qsidNum] = value;
    }

    console.log('[QMK] Final settings object:', settings);
    kbinfo.settings = settings;
  }

  async push(kbinfo: KeyboardInfo, qsid: number): Promise<void> {
    if (!kbinfo.settings) {
      throw new Error('No settings available to push');
    }

    const val = kbinfo.settings[qsid];
    const vals = LE32(val);
    console.log('Pushing QMK setting:', qsid, vals);
    // Use Svil protocol: QMK settings set command
    await this.usb.sendSvil(SvilUSB.CMD_SVIL_QMK_SETTINGS_SET, [...LE16(qsid), ...vals], {});
  }

  /**
   * Reset all QMK settings to defaults
   */
  async reset(): Promise<void> {
    await this.usb.sendSvil(SvilUSB.CMD_SVIL_QMK_SETTINGS_RESET, [], {});
  }
}

export const qmkService = new QMKService(usbInstance);
