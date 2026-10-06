# Proposal: Unified Cosmetic Names System for Viable Protocol

**Date:** 2026-01-19
**Author:** Morgan (via Claude Code)
**Status:** Draft Proposal for Discussion
**Supersedes:** `layer-names-proposal.md`

## Summary

A unified, namespace-based system for storing human-readable names for keyboard entities (layers, tap dances, macros, combos, etc.) that persist to EEPROM and `.viable` files.

## Motivation

Users assign meaningful names to keyboard features: "Gaming" layer, "Email Signature" macro, "Vim Escape" combo. Currently these names exist only in GUI state or file comments—they're lost on reconnect and don't survive a trip to another computer.

The original layer-names proposal (0x18/0x19) solved this for layers only. But the same problem exists for:
- Tap dances ("Double-tap Shift", "Tap-Hold Ctrl")
- Macros ("Git Commit", "Email Signature", "Shrug ¯\\_(ツ)_/¯")
- Combos ("JK Escape", "DF Enter")
- Key overrides ("Shift-Backspace Delete")
- Leader sequences ("Leader-G-C Git Commit")

Adding dedicated command pairs for each feature (0x18/0x19, 0x1A/0x1B, 0x1C/0x1D...) would be:
1. Wasteful of the command ID space
2. Repetitive in firmware implementation
3. Inconsistent as features are added
4. Annoying to maintain

## Design Principles

1. **Single abstraction**: One get/set command pair handles all nameable entities
2. **Namespace isolation**: Each feature type is a distinct namespace
3. **Sparse storage**: Only store non-empty names
4. **Extensible**: Adding new namespaces requires no protocol changes
5. **Firmware simplicity**: Generic implementation, namespace-agnostic core
6. **Graceful degradation**: Unknown namespaces return empty, don't error

## Protocol Specification

### Commands

| Command | ID | Description |
|---------|-----|-------------|
| `cosmetic_name_get` | `0x20` | Retrieve a cosmetic name |
| `cosmetic_name_set` | `0x21` | Store a cosmetic name |
| `cosmetic_name_info` | `0x22` | Get pool statistics (entry count, capacity, usage) |

### Namespaces

| ID | Namespace | Description |
|----|-----------|-------------|
| `0x00` | `layer` | Layer names |
| `0x01` | `tapdance` | Tap dance names |
| `0x02` | `macro` | Macro names |
| `0x03` | `combo` | Combo names |
| `0x04` | `override` | Key override names |
| `0x05` | `leader` | Leader sequence names |
| `0x06`-`0x0F` | (reserved) | Future expansion |

**Entry limits are not hardcoded in the names protocol.** The maximum index for each namespace is determined by the keyboard's feature configuration (e.g., `DYNAMIC_KEYMAP_MACRO_COUNT`), not by the cosmetic names system. The names system trusts that the GUI won't request invalid indices.

### Message Format

**Get Request:**
```
[0xDF][0x20][namespace:1][index:2 LE]
```

**Get Response:**
```
[0xDF][0x20][namespace:1][index:2 LE][name:1-25][0x00]
```

**Set Request:**
```
[0xDF][0x21][namespace:1][index:2 LE][name:1-25][0x00]
```

**Set Response:**
```
[0xDF][0x21][status:1]
```

**Info Request (optional):**
```
[0xDF][0x22]
```

**Info Response:**
```
[0xDF][0x22][entry_count:2 LE][pool_size:2 LE][used_bytes:2 LE]
```

All multi-byte integers are little-endian (LE), consistent with existing Viable protocol.

### Status Codes

| Code | Meaning |
|------|---------|
| `0x00` | Success |
| `0x01` | Invalid namespace |
| `0x02` | Index out of range |
| `0x03` | Name too long |
| `0x04` | Storage full |
| `0x05` | Write error |

### Name Constraints

- **Max length**: 26 bytes (25 characters + null terminator)
- **Encoding**: UTF-8
- **Empty name**: Null byte at position 0, or simply not stored
- **Whitespace**: Leading/trailing whitespace is preserved (GUI may trim)

The 25-character limit is derived from the 32-byte HID message size minus protocol overhead (6 bytes). This is sufficient for typical names like "Git Commit", "Gaming Layer", or "Photoshop Tools".

## Storage

### Context: 128mbit Flash

Svalboard and similar Viable keyboards have 128mbit (16MB) of flash storage. This is vastly more than traditional keyboard EEPROM (typically 1-4KB). We're not constrained by bytes - we can be generous while still being efficient.

### Sparse Key-Value Store

All namespaces use a single sparse pool. Only non-empty names consume storage.

```
Header (8 bytes):
  [magic:2][version:1][reserved:1][entry_count:2][pool_size:2]

Entry format (variable length):
  [namespace:1][index:2][length:1][name:length]

Example storage for 5 named items:
  Header: [0xCE][0xED][0x01][0x00][0x05][0x00][0x00][0x20]  <- Magic, v1, 5 entries, 8KB pool
  Entry:  [0x00][0x00][0x00][0x04]"Base"                    <- Layer 0 = "Base"
  Entry:  [0x00][0x01][0x00][0x06]"Gaming"                  <- Layer 1 = "Gaming"
  Entry:  [0x00][0x02][0x00][0x03]"NAS"                     <- Layer 2 = "NAS"
  Entry:  [0x02][0x00][0x00][0x0A]"Git Commit"              <- Macro 0 = "Git Commit"
  Entry:  [0x03][0x05][0x00][0x09]"JK Escape"               <- Combo 5 = "JK Escape"
```

**Key changes from minimal EEPROM version:**
- Index is 2 bytes (supports up to 65535 entries per namespace)
- Header includes pool size (firmware can report capacity)
- Header has version byte for future format changes

**Storage calculation:**
- Header: 8 bytes (fixed)
- Per entry: 4 bytes overhead + name length
- Typical name: 10 characters average

**Default pool size:** 8KB (8192 bytes)

This supports approximately:
- 8192 - 8 = 8184 bytes for entries
- At 14 bytes per entry (4 overhead + 10 chars): ~584 names
- Power user (100 macros + 50 combos + 16 layers + misc, all named): ~2.3KB

**Rationale:**
- 8KB is trivial on a 16MB device
- 2-byte index future-proofs for power users with 100+ macros
- Sparse storage still pays only for what's used
- Pool size in header lets GUI show "X of Y names used"
- Version byte allows format evolution without breaking existing data

## File Format

### .viable Extension

Add a single `names` object with nested namespaces:

```json
{
  "version": 1,
  "uid": "...",
  "name": "Svalboard",
  "names": {
    "layer": {
      "0": "Base",
      "1": "Gaming",
      "2": "Photoshop",
      "5": "NAS"
    },
    "macro": {
      "0": "Git Commit",
      "3": "Email Sig",
      "7": "Shrug"
    },
    "combo": {
      "0": "JK Escape",
      "5": "DF Enter"
    },
    "tapdance": {
      "2": "Shift Dance"
    }
  },
  "layout": [...],
  ...
}
```

**Design notes:**
- Namespaces use string keys matching protocol namespace names
- Indices are string keys (JSON doesn't support integer keys)
- Only non-empty names are stored (sparse)
- Missing namespace or index = use default (index number or empty)
- Backwards compatible: old files without `names` work fine

### Migration from Existing Formats

The `cosmetic.layer` field in current `.viable` files should be migrated:

```json
// Old format
{ "cosmetic": { "layer": { "0": "Base" } } }

// New format
{ "names": { "layer": { "0": "Base" } } }
```

GUI should read both formats, write only the new format.

## Firmware Implementation

### Header (viable_names.h)

```c
#ifndef VIABLE_NAMES_H
#define VIABLE_NAMES_H

#include <stdint.h>
#include <stdbool.h>

// Namespace IDs
typedef enum {
    VIABLE_NS_LAYER     = 0x00,
    VIABLE_NS_TAPDANCE  = 0x01,
    VIABLE_NS_MACRO     = 0x02,
    VIABLE_NS_COMBO     = 0x03,
    VIABLE_NS_OVERRIDE  = 0x04,
    VIABLE_NS_LEADER    = 0x05,
    VIABLE_NS_COUNT     = 0x06
} viable_namespace_t;

// Status codes
typedef enum {
    VIABLE_NAME_OK              = 0x00,
    VIABLE_NAME_INVALID_NS      = 0x01,
    VIABLE_NAME_INDEX_OOB       = 0x02,
    VIABLE_NAME_TOO_LONG        = 0x03,
    VIABLE_NAME_STORAGE_FULL    = 0x04,
    VIABLE_NAME_WRITE_ERROR     = 0x05
} viable_name_status_t;

#define VIABLE_NAME_MAX_LENGTH  26

// Get a cosmetic name (returns empty string if not set)
// Index range is not validated - caller should use keyboard config limits
viable_name_status_t viable_names_get(
    viable_namespace_t ns,
    uint16_t index,
    char *out_name,
    uint8_t max_len
);

// Set a cosmetic name (empty string = delete)
viable_name_status_t viable_names_set(
    viable_namespace_t ns,
    uint16_t index,
    const char *name
);

// Get pool statistics
viable_name_status_t viable_names_info(
    uint16_t *out_entry_count,
    uint16_t *out_pool_size,
    uint16_t *out_used_bytes
);

// Clear all names in a namespace (or all if ns == 0xFF)
void viable_names_clear(viable_namespace_t ns);

// Initialize name storage (call on boot)
void viable_names_init(void);

#endif
```

### Implementation (viable_names.c)

```c
#include "viable_names.h"
#include "viable_eeprom.h"
#include <string.h>

// Sparse pool storage
#define VIABLE_NAMES_POOL_SIZE    8192  // 8KB default
#define VIABLE_NAMES_MAGIC        0xCEED
#define VIABLE_NAMES_VERSION      0x01

typedef struct {
    uint16_t magic;
    uint8_t  version;
    uint8_t  reserved;
    uint16_t entry_count;
    uint16_t pool_size;
} viable_names_header_t;

// Find entry in sparse pool, returns offset or -1 if not found
static int32_t viable_names_find(viable_namespace_t ns, uint16_t index) {
    viable_names_header_t header;
    viable_read_storage(VIABLE_NAMES_OFFSET, &header, sizeof(header));

    if (header.magic != VIABLE_NAMES_MAGIC) return -1;

    uint32_t offset = sizeof(header);
    for (uint16_t i = 0; i < header.entry_count; i++) {
        uint8_t entry_ns, entry_len;
        uint16_t entry_idx;
        viable_read_storage(VIABLE_NAMES_OFFSET + offset, &entry_ns, 1);
        viable_read_storage(VIABLE_NAMES_OFFSET + offset + 1, &entry_idx, 2);
        viable_read_storage(VIABLE_NAMES_OFFSET + offset + 3, &entry_len, 1);

        if (entry_ns == ns && entry_idx == index) {
            return offset;
        }
        offset += 4 + entry_len;
    }
    return -1;
}

viable_name_status_t viable_names_get(
    viable_namespace_t ns,
    uint16_t index,
    char *out_name,
    uint8_t max_len
) {
    if (ns >= VIABLE_NS_COUNT) return VIABLE_NAME_INVALID_NS;
    if (max_len < 1) return VIABLE_NAME_TOO_LONG;

    int32_t offset = viable_names_find(ns, index);
    if (offset < 0) {
        out_name[0] = '\0';
        return VIABLE_NAME_OK;  // Not found = empty name
    }

    uint8_t len;
    viable_read_storage(VIABLE_NAMES_OFFSET + offset + 3, &len, 1);
    if (len >= max_len) len = max_len - 1;

    viable_read_storage(VIABLE_NAMES_OFFSET + offset + 4, out_name, len);
    out_name[len] = '\0';
    return VIABLE_NAME_OK;
}

viable_name_status_t viable_names_set(
    viable_namespace_t ns,
    uint16_t index,
    const char *name
) {
    if (ns >= VIABLE_NS_COUNT) return VIABLE_NAME_INVALID_NS;

    size_t len = name ? strlen(name) : 0;
    if (len >= VIABLE_NAME_MAX_LENGTH) return VIABLE_NAME_TOO_LONG;

    // Delete existing entry (if any) then append new one
    // Compaction happens on delete to avoid fragmentation
    viable_names_delete(ns, index);

    if (len == 0) return VIABLE_NAME_OK;  // Empty = just delete

    // Append new entry to end of pool
    return viable_names_append(ns, index, name, len);
}

viable_name_status_t viable_names_info(
    uint16_t *out_entry_count,
    uint16_t *out_pool_size,
    uint16_t *out_used_bytes
) {
    viable_names_header_t header;
    viable_read_storage(VIABLE_NAMES_OFFSET, &header, sizeof(header));

    if (header.magic != VIABLE_NAMES_MAGIC) {
        *out_entry_count = 0;
        *out_pool_size = VIABLE_NAMES_POOL_SIZE;
        *out_used_bytes = sizeof(header);
        return VIABLE_NAME_OK;
    }

    *out_entry_count = header.entry_count;
    *out_pool_size = header.pool_size;

    // Calculate used bytes by walking entries
    uint32_t offset = sizeof(header);
    for (uint16_t i = 0; i < header.entry_count; i++) {
        uint8_t entry_len;
        viable_read_storage(VIABLE_NAMES_OFFSET + offset + 3, &entry_len, 1);
        offset += 4 + entry_len;
    }
    *out_used_bytes = offset;

    return VIABLE_NAME_OK;
}
```

### Protocol Handler

```c
// In viable.c command handler

case viable_cmd_cosmetic_name_get: {  // 0x20
    uint8_t ns = data[2];
    uint16_t idx = data[3] | (data[4] << 8);  // Little-endian
    char name[VIABLE_NAME_MAX_LENGTH] = {0};

    viable_name_status_t status = viable_names_get(ns, idx, name, sizeof(name));

    data[2] = ns;
    data[3] = idx & 0xFF;
    data[4] = (idx >> 8) & 0xFF;
    if (status == VIABLE_NAME_OK) {
        memcpy(&data[5], name, strlen(name) + 1);
    } else {
        data[5] = 0;  // Empty name on error
    }
    break;
}

case viable_cmd_cosmetic_name_set: {  // 0x21
    uint8_t ns = data[2];
    uint16_t idx = data[3] | (data[4] << 8);  // Little-endian
    char name[VIABLE_NAME_MAX_LENGTH];

    // Copy name, ensure null-terminated
    size_t max_copy = sizeof(name) - 1;
    strncpy(name, (char*)&data[5], max_copy);
    name[max_copy] = '\0';

    data[2] = viable_names_set(ns, idx, name);
    break;
}

case viable_cmd_cosmetic_name_info: {  // 0x22
    uint16_t entry_count, pool_size, used_bytes;
    viable_names_info(&entry_count, &pool_size, &used_bytes);

    data[2] = entry_count & 0xFF;
    data[3] = (entry_count >> 8) & 0xFF;
    data[4] = pool_size & 0xFF;
    data[5] = (pool_size >> 8) & 0xFF;
    data[6] = used_bytes & 0xFF;
    data[7] = (used_bytes >> 8) & 0xFF;
    break;
}
```

## GUI Implementation

### TypeScript Types (keybard-ng)

```typescript
// src/types/names.types.ts

export type CosmeticNamespace =
  | 'layer'
  | 'tapdance'
  | 'macro'
  | 'combo'
  | 'override'
  | 'leader';

export const NAMESPACE_IDS: Record<CosmeticNamespace, number> = {
  layer: 0x00,
  tapdance: 0x01,
  macro: 0x02,
  combo: 0x03,
  override: 0x04,
  leader: 0x05,
};

export type CosmeticNames = {
  [K in CosmeticNamespace]?: Record<string, string>;
};

export interface NameService {
  getName(ns: CosmeticNamespace, index: number): Promise<string>;
  setName(ns: CosmeticNamespace, index: number, name: string): Promise<void>;
  getInfo(): Promise<{ entryCount: number; poolSize: number; usedBytes: number }>;
}

export interface PoolInfo {
  entryCount: number;
  poolSize: number;
  usedBytes: number;
}
```

### Service Implementation

```typescript
// src/services/names.service.ts

export class NamesService implements NameService {
  constructor(private usb: SvilUSB) {}

  async getName(ns: CosmeticNamespace, index: number): Promise<string> {
    const nsId = NAMESPACE_IDS[ns];
    const response = await this.usb.viableCommand(
      CMD_COSMETIC_NAME_GET,  // 0x20
      [nsId, index & 0xff, (index >> 8) & 0xff]  // 2-byte LE index
    );
    // Response: [cmd][ns][idx_lo][idx_hi][name...][0x00]
    return this.decodeString(response.slice(5));
  }

  async setName(ns: CosmeticNamespace, index: number, name: string): Promise<void> {
    const nsId = NAMESPACE_IDS[ns];
    const nameBytes = new TextEncoder().encode(name);
    if (nameBytes.length >= 26) {
      throw new Error('Name too long (max 25 characters)');
    }

    const payload = new Uint8Array(nameBytes.length + 4);
    payload[0] = nsId;
    payload[1] = index & 0xff;           // index low byte
    payload[2] = (index >> 8) & 0xff;    // index high byte
    payload.set(nameBytes, 3);
    payload[nameBytes.length + 3] = 0;   // null terminator

    const response = await this.usb.viableCommand(CMD_COSMETIC_NAME_SET, payload);
    const status = response[2];
    if (status !== 0) {
      throw new Error(`Failed to set name: status ${status}`);
    }
  }

  async getInfo(): Promise<PoolInfo> {
    const response = await this.usb.viableCommand(CMD_COSMETIC_NAME_INFO, []);
    return {
      entryCount: response[2] | (response[3] << 8),
      poolSize: response[4] | (response[5] << 8),
      usedBytes: response[6] | (response[7] << 8),
    };
  }

  // Fetch names for indices that have entries (requires keyboard to provide list)
  // For now, GUI maintains its own list of which indices have names
  async getAllNamesForIndices(ns: CosmeticNamespace, indices: number[]): Promise<Record<number, string>> {
    const names: Record<number, string> = {};
    for (const index of indices) {
      const name = await this.getName(ns, index);
      if (name) {
        names[index] = name;
      }
    }
    return names;
  }

  private decodeString(data: Uint8Array): string {
    const nullIndex = data.indexOf(0);
    const bytes = nullIndex >= 0 ? data.slice(0, nullIndex) : data;
    return new TextDecoder().decode(bytes);
  }
}
```

### Context Integration

```typescript
// In KeyboardContext or a new NamesContext

const [names, setNames] = useState<CosmeticNames>({});

// On keyboard connect, fetch all names
useEffect(() => {
  if (!keyboard) return;

  const fetchNames = async () => {
    const allNames: CosmeticNames = {};
    for (const ns of Object.keys(NAMESPACE_IDS) as CosmeticNamespace[]) {
      allNames[ns] = await namesService.getAllNames(ns);
    }
    setNames(allNames);
  };

  fetchNames();
}, [keyboard]);

// Helper to get display name with fallback
const getDisplayName = (ns: CosmeticNamespace, index: number): string => {
  return names[ns]?.[index] ?? `${ns} ${index}`;
};
```

## UI Integration

### Layer Selector

```tsx
// In LayerSelector.tsx
<button onClick={() => setLayer(i)}>
  {getDisplayName('layer', i) || `Layer ${i}`}
</button>
```

### Macro Panel

```tsx
// In MacrosPanel.tsx
<div className="macro-row">
  <span className="macro-name">
    {getDisplayName('macro', macro.index) || `Macro ${macro.index}`}
  </span>
  <button onClick={() => openRenameDialog('macro', macro.index)}>
    ✏️
  </button>
</div>
```

### Generic Rename Dialog

```tsx
// In RenameDialog.tsx
interface RenameDialogProps {
  namespace: CosmeticNamespace;
  index: number;
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

const RenameDialog: React.FC<RenameDialogProps> = ({
  namespace, index, currentName, onSave, onClose
}) => {
  const [name, setName] = useState(currentName);
  const maxLength = 25;

  return (
    <Dialog onClose={onClose}>
      <h3>Rename {namespace} {index}</h3>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, maxLength))}
        placeholder={`${namespace} ${index}`}
      />
      <span>{name.length}/{maxLength}</span>
      <button onClick={() => onSave(name)}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </Dialog>
  );
};
```

## Alternatives Considered

### Alt 1: Separate Commands Per Feature

Original layer-names proposal: 0x18/0x19 for layers, 0x1A/0x1B for tap dances, etc.

**Rejected because:**
- Wastes command ID space
- Duplicates firmware code
- Inconsistent extension pattern
- Harder to maintain

### Alt 2: Store Names in Feature Data

Embed name in each feature's existing storage (e.g., in macro blob).

**Rejected because:**
- Incompatible with existing data formats
- Would require major protocol changes to macros, combos, etc.
- Names and functional data have different lifetimes

### Alt 3: GUI-Only Names (No Firmware)

Store names only in `.viable` files and GUI state.

**Rejected because:**
- Names lost when switching computers
- Doesn't fulfill "saved to keyboard" expectation
- Already how it works today (and it's the problem)

### Alt 4: External Name Database

Store names in a separate file or cloud service keyed by keyboard UID.

**Rejected because:**
- Requires infrastructure
- Privacy concerns
- Doesn't work offline
- Over-engineered for the problem

### Alt 5: Fixed EEPROM Allocation

Pre-allocate storage for all possible entries (16 layers × 24 bytes = 384 bytes just for layers).

**Rejected because:**
- Users typically use 4-5 layers, not 16
- Would waste ~3KB for worst-case across all namespaces
- Sparse storage uses only ~100-150 bytes for typical usage
- No meaningful benefit to O(1) lookup for infrequent operations

## Migration Path

1. **Firmware v1**: Implement commands 0x20/0x21 with sparse pool storage
2. **GUI**: Add NamesService, migrate layer name UI to use it
3. **File format**: Read `cosmetic.layer` (old) and `names` (new), write only `names`
4. **GUI v2**: Add rename buttons to tap dance, macro, combo, override panels
5. **Bulk command**: Add 0x22 for bulk name fetch (optimization, optional)

## Open Questions

1. **Bulk fetch**: Should we add a command to fetch all names at once? (Could return list of namespace+index pairs that have names, letting GUI fetch only what exists.)
2. **Notifications**: Should firmware notify GUI when names change (multi-client scenario)?
3. **Defaults**: Should firmware ever provide default names, or always defer to GUI?

## Storage Budget Analysis

Single sparse pool: **8KB** (configurable per keyboard)

| Scenario | Entries | Avg Name | Overhead | Total |
|----------|---------|----------|----------|-------|
| Minimal | 4 layers | 6 chars | 8 + 16 | ~64 bytes |
| Typical | 5 layers, 3 macros, 2 combos | 8 chars | 8 + 40 | ~148 bytes |
| Heavy | 8 layers, 20 macros, 15 combos | 12 chars | 8 + 172 | ~860 bytes |
| Power user | 16 layers, 100 macros, 50 combos | 14 chars | 8 + 664 | ~3KB |
| Extreme | 200 entries, all named | 12 chars | 8 + 800 | ~4KB |

**Notes:**
- Per-entry overhead is 4 bytes (1 namespace + 2 index + 1 length)
- Header is 8 bytes
- 8KB pool supports ~500 entries at average 12-char names
- Pool size is trivial on 16MB flash - could easily increase to 16KB or 32KB if needed
- GUI can display "X names / Y KB used" via the info command

## References

- Superseded: `docs/proposals/layer-names-proposal.md`
- Viable protocol: `viable-qmk/modules/viable-kb/core/viable.c`
- Existing command IDs: 0x00-0x17 (names start at 0x20)
- File format: `viable-gui/src/main/python/protocol/keyboard_comm.py`
