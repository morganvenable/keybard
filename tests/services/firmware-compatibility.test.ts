import { describe, expect, it } from 'vitest';
import { requireProductionFirmware, SvalPreviewRequiredError } from '../../src/services/firmware-compatibility';

describe('production firmware compatibility', () => {
    it.each([{ viable: {} }, { name: 'Svalboard', vial_protocol: 6 }, {}, null])(
        'leaves existing non-Sval definitions unchanged: %j', (definition) => {
            expect(() => requireProductionFirmware(definition)).not.toThrow();
        },
    );
    it.each([{ sval: {} }, { sval: {}, viable: {} }])(
        'requires preview for an explicit Sval namespace: %j', (definition) => {
            expect(() => requireProductionFirmware(definition)).toThrow(SvalPreviewRequiredError);
        },
    );
});
