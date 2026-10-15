import { createBlockEditor as mount } from './editor.js';
import { createTablePlugin } from './plugins/table.js';

export { createTablePlugin };

/**
 * Block editor with the built-in table plugin.
 * Pass `builtin: false` to supply plugins yourself.
 */
export function createBlockEditor(container, options = {}) {
    const extra = options.plugins || [];
    const plugins = options.builtin === false ? extra : [createTablePlugin(), ...extra];
    return mount(container, { ...options, plugins });
}
