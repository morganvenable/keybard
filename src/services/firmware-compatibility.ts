export const SVAL_PREVIEW_URL = 'https://morganvenable.github.io/keybard-sval-preview/';

export class SvalPreviewRequiredError extends Error {
    constructor() {
        super('This board is only compatible with the latest version of Keybard. Please go here to open it.');
        this.name = 'SvalPreviewRequiredError';
    }
}

// Check the explicit definition namespace, not product names or numeric
// protocol versions shared by both firmware families.
export function requireProductionFirmware(definition: unknown): void {
    if (definition && typeof definition === 'object' &&
        Object.prototype.hasOwnProperty.call(definition, 'sval')) {
        throw new SvalPreviewRequiredError();
    }
}
