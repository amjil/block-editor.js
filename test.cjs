// Behaviour tests. jsdom does not load ES modules, so both files are
// evaluated as classic scripts inside the window.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

function classic(file, exportName) {
    return fs.readFileSync(path.join(__dirname, file), 'utf8')
        .replace(new RegExp('^export function ' + exportName, 'm'), 'function ' + exportName);
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
    if (!/Not implemented/.test(e.message)) errors.push(e.message);
});
vc.on('error', (m) => errors.push(String(m)));

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>',
    { runScripts: 'dangerously', virtualConsole: vc, pretendToBeVisual: true });
const { window: win } = dom;
const doc = win.document;
doc.execCommand = () => true;
doc.queryCommandState = () => false;

win.eval(classic('src/plugins/table.js', 'createTablePlugin') + '\n' +
    classic('src/editor.js', 'createBlockEditor') + '\n' +
    'window.createTablePlugin = createTablePlugin;\nwindow.createBlockEditor = createBlockEditor;');

const api = win.createBlockEditor('#host', { plugins: [win.createTablePlugin()] });
const editor = doc.querySelector('.editor-content');

let pass = 0;
const fails = [];
function check(name, cond, extra) {
    if (cond) { pass++; console.log('  ok   ' + name); }
    else { fails.push(name); console.log('  FAIL ' + name + (extra ? '\n         ' + extra : '')); }
}

check('empty document has one paragraph', editor.querySelectorAll(':scope > .block-wrapper').length === 1);
check('paragraph receives an id', !!editor.querySelector('.block-wrapper').dataset.blockId);
check('table button is registered', !!doc.querySelector('button[data-block="table"]'));

const id = '11111111-1111-4111-8111-111111111111';
api.setBlocks([
    { id, type: 'paragraph', text: 'hello', children: [
        { id: '22222222-2222-4222-8222-222222222222', type: 'task', text: 'todo', checked: true }
    ]},
    {
        id: '33333333-3333-4333-8333-333333333333',
        type: 'table',
        data: { 'col-count': 2, 'row-count': 2, cells: { '0,0': 'ᠠ', '1,1': 'ᠪ' } }
    }
]);

const blocks = api.getBlocks();
check('round-trip keeps ids', blocks[0].id === id && blocks[0].children[0].id === '22222222-2222-4222-8222-222222222222');
check('round-trip keeps text', blocks[0].text === 'hello');
check('task checked survives', blocks[0].children[0].type === 'task' && blocks[0].children[0].checked === true);
check('table cell map survives',
    blocks[1].type === 'table' &&
    blocks[1].data['col-count'] === 2 &&
    blocks[1].data.cells['0,0'] === 'ᠠ' &&
    blocks[1].data.cells['1,1'] === 'ᠪ',
    JSON.stringify(blocks[1]));
check('table is atomic content', editor.querySelector('[data-block-type="table"] > .block-content').getAttribute('contenteditable') === 'false');
check('cells are editable', editor.querySelectorAll('.mgl-cell[contenteditable="true"]').length === 4);

const cell = editor.querySelector('.mgl-cell');
cell.textContent = 'ᠡ';
cell.dispatchEvent(new win.Event('input', { bubbles: true }));
check('edited cell is exported', api.getBlocks()[1].data.cells['0,0'] === 'ᠡ');

doc.querySelector('button[data-table="add-col"]').click();
check('add column', api.getBlocks()[1].data['col-count'] === 3);

// ---- notes mode (mgl-notes-app) ---------------------------------------------
const notesHost = doc.createElement('div');
doc.body.appendChild(notesHost);
const notes = win.createBlockEditor(notesHost, { mode: 'notes' });
const notesRoot = notesHost.querySelector('.editor-content');

function caretIn(wrapperIndex, atEnd) {
    const content = notesRoot.querySelectorAll('.block-wrapper')[wrapperIndex].querySelector('.block-content');
    content.focus();
    const range = doc.createRange();
    range.selectNodeContents(content);
    range.collapse(!atEnd);
    const sel = win.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}
function caretBlock() {
    const node = win.getSelection().anchorNode;
    const el = node && (node.nodeType === 1 ? node : node.parentElement);
    return el && el.closest('.block-wrapper');
}
function key(name, opts = {}) {
    const ev = new win.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...opts });
    caretBlock().querySelector('.block-content').dispatchEvent(ev);
    return ev;
}
const notesTexts = () => notes.getBlocks().map((b) => b.type + ':' + b.text);

check('notes mode flag', notes.isNotesMode() === true);

notes.setBlocks([{ id: 'n1', type: 'list-item', text: 'one' }]);
caretIn(0, true);
notes.insertBreak();
check('enter in list item continues the list', notesTexts().join('|') === 'list-item:one|list-item:', notesTexts().join('|'));

notes.setBlocks([{ id: 'h1', type: 'heading-1', text: 'title' }]);
caretIn(0, true);
notes.insertBreak();
check('enter in heading starts a paragraph', notesTexts().join('|') === 'heading-1:title|paragraph:', notesTexts().join('|'));

notes.setBlocks([
    { id: 'm1', type: 'paragraph', text: 'ab' },
    { id: 'm2', type: 'paragraph', text: 'cd' },
]);
caretIn(1, false);
notes.deleteAtBoundary();
check('backspace at block start merges into previous', notesTexts().join('|') === 'paragraph:abcd', notesTexts().join('|'));

notes.setBlocks([
    { id: 'j1', type: 'paragraph', text: 'first' },
    { id: 'j2', type: 'paragraph', text: 'last' },
]);
caretIn(0, false);
check('mod+end is handled', key('End', { ctrlKey: true }).defaultPrevented);
const jumpBlock = caretBlock();
check('mod+end jumps to the last block', jumpBlock && jumpBlock.dataset.blockId === 'j2');
check('shift+home keeps native selection', !key('Home', { shiftKey: true }).defaultPrevented);

notes.setBlocks([{ id: 's1', type: 'paragraph', text: 'word ' }]);
check('trailing space survives export', notes.getBlocks()[0].html.endsWith(' '), JSON.stringify(notes.getBlocks()[0].html));

if (errors.length) {
    console.log('jsdom errors:\n' + errors.join('\n'));
    process.exit(1);
}
console.log(pass + ' passed, ' + fails.length + ' failed');
if (fails.length) process.exit(1);
