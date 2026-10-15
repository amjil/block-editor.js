/**
 * Vertical-script table block.
 *
 * Cell text is stored the same way as the Flutter notes editor:
 *   { "col-count", "row-count", cells: { "c,r": "text" } }
 * Column 0 is the header column. The grid itself is horizontal;
 * each cell is writing-mode: vertical-lr.
 */

const TABLE_CSS = `
.mgl-editor-scope .mgl-table {
  writing-mode: horizontal-tb;
  -webkit-writing-mode: horizontal-tb;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin: 0 10px;
}
.mgl-editor-scope .mgl-table-bar {
  display: flex;
  gap: 4px;
  writing-mode: horizontal-tb;
}
.mgl-editor-scope .mgl-table-bar button {
  font: 12px/1.2 sans-serif;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.mgl-editor-scope .mgl-table-grid {
  display: grid;
  border-top: 1px solid #ccc;
  border-left: 1px solid #ccc;
  background: #fff;
}
.mgl-editor-scope .mgl-cell {
  writing-mode: vertical-lr;
  -webkit-writing-mode: vertical-lr;
  box-sizing: border-box;
  width: 64px;
  height: 160px;
  padding: 8px 4px;
  border-right: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  overflow: auto;
  outline: none;
  font-size: 18px;
  line-height: 1.6;
}
.mgl-editor-scope .mgl-cell-header {
  background: rgba(26, 122, 179, 0.08);
  font-weight: 600;
}
.mgl-editor-scope .mgl-cell:focus {
  background: #f3f8fc;
}
`;

function cellKey(c, r) {
    return c + ',' + r;
}

function normalize(data) {
    const src = data || {};
    const cols = Math.max(1, Number(src['col-count'] ?? src.colCount ?? 2) || 2);
    const rows = Math.max(1, Number(src['row-count'] ?? src.rowCount ?? 2) || 2);
    const raw = src.cells || {};
    const cells = {};
    Object.keys(raw).forEach((key) => {
        cells[String(key)] = raw[key] == null ? '' : String(raw[key]);
    });
    return { cols, rows, cells };
}

function readGrid(root) {
    const grid = root.querySelector('.mgl-table-grid');
    const cols = Number(grid.dataset.cols) || 1;
    const rows = Number(grid.dataset.rows) || 1;
    const cells = {};
    grid.querySelectorAll('.mgl-cell').forEach((cell) => {
        const text = cell.textContent.replace(/\u200b/g, '').trim();
        if (text) cells[cell.dataset.key] = text;
    });
    return { cols, rows, cells };
}

function fillGrid(grid, cols, rows, cells) {
    grid.dataset.cols = String(cols);
    grid.dataset.rows = String(rows);
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', 64px)';
    grid.replaceChildren();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'mgl-cell' + (c === 0 ? ' mgl-cell-header' : '');
            cell.setAttribute('contenteditable', 'true');
            cell.spellcheck = false;
            cell.dataset.key = cellKey(c, r);
            cell.textContent = cells[cellKey(c, r)] || '';
            grid.appendChild(cell);
        }
    }
}

export function createTablePlugin() {
    return {
        type: 'table',
        label: 'Table',
        title: 'Table',
        atomic: true,
        css: TABLE_CSS,
        defaultData() {
            return { 'col-count': 2, 'row-count': 2, cells: {} };
        },
        build({ data, notify }) {
            const root = document.createElement('div');
            root.className = 'mgl-table';
            const bar = document.createElement('div');
            bar.className = 'mgl-table-bar';
            bar.contentEditable = 'false';
            bar.innerHTML = [
                '<button type="button" data-table="add-col">+ Col</button>',
                '<button type="button" data-table="del-col">− Col</button>',
                '<button type="button" data-table="add-row">+ Row</button>',
                '<button type="button" data-table="del-row">− Row</button>'
            ].join('');
            const grid = document.createElement('div');
            grid.className = 'mgl-table-grid';
            const initial = normalize(data);
            fillGrid(grid, initial.cols, initial.rows, initial.cells);
            root.append(bar, grid);

            bar.addEventListener('click', (event) => {
                const btn = event.target.closest('button[data-table]');
                if (!btn) return;
                event.preventDefault();
                event.stopPropagation();
                const current = readGrid(root);
                let { cols, rows, cells } = current;
                if (btn.dataset.table === 'add-col') cols += 1;
                if (btn.dataset.table === 'del-col' && cols > 1) {
                    cols -= 1;
                    cells = dropIndex(cells, 'c', cols);
                }
                if (btn.dataset.table === 'add-row') rows += 1;
                if (btn.dataset.table === 'del-row' && rows > 1) {
                    rows -= 1;
                    cells = dropIndex(cells, 'r', rows);
                }
                fillGrid(grid, cols, rows, cells);
                if (typeof notify === 'function') notify();
            });
            return root;
        },
        read(wrapper) {
            const root = wrapper.querySelector('.mgl-table');
            if (!root) return { html: '', text: '', data: { 'col-count': 2, 'row-count': 2, cells: {} } };
            const { cols, rows, cells } = readGrid(root);
            return {
                html: '',
                text: Object.keys(cells).sort().map((key) => cells[key]).join(' '),
                data: { 'col-count': cols, 'row-count': rows, cells }
            };
        },
        attach(editor, { notify }) {
            editor.addEventListener('keydown', (event) => {
                const cell = event.target.closest && event.target.closest('.mgl-cell');
                if (!cell || !editor.contains(cell)) return;
                if (event.key === 'Tab') {
                    event.preventDefault();
                    event.stopPropagation();
                    const cells = Array.from(cell.closest('.mgl-table').querySelectorAll('.mgl-cell'));
                    const index = cells.indexOf(cell);
                    const next = cells[index + (event.shiftKey ? -1 : 1)];
                    if (next) next.focus();
                    return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    document.execCommand('insertLineBreak');
                    if (typeof notify === 'function') notify();
                }
            }, true);
        }
    };
}

function dropIndex(cells, axis, keep) {
    const next = {};
    Object.keys(cells).forEach((key) => {
        const [c, r] = key.split(',').map(Number);
        if (axis === 'c' && c >= keep) return;
        if (axis === 'r' && r >= keep) return;
        next[key] = cells[key];
    });
    return next;
}
