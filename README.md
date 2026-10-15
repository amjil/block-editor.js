# Block editor

Traditional Mongolian block editor built on the vertical block tree from [richtext-editor.js](../richtext-editor.js), with an added plugin API.

Text blocks (paragraph, heading, list, todo, quote, callout, toggle, image, bookmark, divider) keep the original editing behavior. Atomic blocks such as tables are registered via plugins and are not baked into the rich-text single file.

```js
import { createBlockEditor } from './src/index.js';

const editor = createBlockEditor('#host', {
  onChange(blocks) {}
});

editor.setBlocks([{ id, type: 'paragraph', text: '' }]);
editor.getBlocks();
// [{ id, type, html, text, data, checked, children }]
```

Table data matches the notes Flutter client: `{ "col-count", "row-count", cells: { "col,row": "text" } }`. Cell text uses `vertical-lr`; the cell grid itself is horizontal. Tab moves between cells.

Run the demo locally:

```bash
npm install
npm test
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080`.

Custom plugins:

```js
{
  type: 'table',
  label: 'Table',
  atomic: true,
  css: '...',
  defaultData() { return {}; },
  build({ data, notify }) { return element; },
  read(wrapper) { return { html, text, data }; },
  attach(editor, { notify }) {}
}
```

Pass `{ plugins, builtin: false }` to `createBlockEditor(el, …)` to replace the built-in table.
