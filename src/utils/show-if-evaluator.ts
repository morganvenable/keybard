/**
 * showIf Expression Evaluator for VIA3 Custom UI
 *
 * Evaluates conditional visibility expressions like:
 * - "{id_automouse_enable} == 1"
 * - "{id_left_scroll_mode} != 0"
 * - "{id_dpi} > 800"
 *
 * Supports operators: ==, !=, <, >, <=, >=
 */

/**
 * Evaluate a condition such as "{id_automouse_enable} == 1" against the values read.
 * Undefined when its value wasn't read (never a guess either way); true for a missing
 * or malformed expression, which is a definition problem, not board state.
 */
export function evaluateCondition(expression: string, values: Map<string, number>): boolean | undefined {
    if (!expression || typeof expression !== 'string') {
        return true; // No expression means always visible
    }

    try {
        // Pattern: {key} operator value
        // Examples: "{id_automouse_enable} == 1", "{id_mode} != 0"
        const pattern = /^\s*\{([^}]+)\}\s*(==|!=|<=|>=|<|>)\s*(-?\d+)\s*$/;
        const match = expression.match(pattern);

        if (!match) {
            console.warn(`Invalid showIf expression format: "${expression}"`);
            return true; // Default to visible for invalid expressions
        }

        const [, key, operator, valueStr] = match;
        const compareValue = parseInt(valueStr, 10);
        const actualValue = values.get(key);

        // Not read from the board: unknown, not true or false.
        if (actualValue === undefined) {
            return undefined;
        }

        // Evaluate comparison
        switch (operator) {
            case '==':
                return actualValue === compareValue;
            case '!=':
                return actualValue !== compareValue;
            case '<':
                return actualValue < compareValue;
            case '>':
                return actualValue > compareValue;
            case '<=':
                return actualValue <= compareValue;
            case '>=':
                return actualValue >= compareValue;
            default:
                console.warn(`Unknown operator in showIf: "${operator}"`);
                return true;
        }
    } catch (error) {
        console.warn(`Error evaluating showIf expression "${expression}":`, error);
        return true; // Default to visible on error
    }
}

/**
 * Whether a control with this showIf is shown. A control whose condition depends on a
 * value that wasn't read stays hidden until that value is read: Keybard can't tell
 * whether it applies.
 */
export function evaluateShowIf(expression: string, values: Map<string, number>): boolean {
    return evaluateCondition(expression, values) ?? false;
}

/**
 * Extract all value keys referenced in showIf expressions from a menu tree
 * This is useful for knowing which values need to be monitored for changes
 */
export function extractShowIfKeys(expression: string): string | null {
    if (!expression) return null;

    const pattern = /\{([^}]+)\}/;
    const match = expression.match(pattern);

    return match ? match[1] : null;
}
