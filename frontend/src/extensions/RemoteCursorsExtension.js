import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const REMOTE_CURSORS_KEY = new PluginKey('remoteCursors');

const RemoteCursorsExtension = Extension.create({
  name: 'remoteCursors',

  addCommands() {
    return {
      setRemoteCursors:
        (cursors) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(REMOTE_CURSORS_KEY, { cursors });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: REMOTE_CURSORS_KEY,

        state: {
          init() {
            return { cursors: {}, decorations: DecorationSet.empty };
          },

          apply(tr, pluginState, _oldState, newState) {
            const meta = tr.getMeta(REMOTE_CURSORS_KEY);

            // New cursors arrived over the socket
            if (meta?.cursors !== undefined) {
              return {
                cursors: meta.cursors,
                decorations: buildDecorations(newState.doc, meta.cursors),
              };
            }

            // Document text changed (e.g. setContent was called) —
            // rebuild decorations from stored cursor memory so they
            // are never wiped by a full doc replace.
            if (tr.docChanged) {
              return {
                cursors: pluginState.cursors,
                decorations: buildDecorations(newState.doc, pluginState.cursors),
              };
            }

            return pluginState;
          },
        },

        props: {
          decorations(state) {
            return this.getState(state).decorations;
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDecorations(doc, cursors) {
  const decorations = [];

  Object.entries(cursors).forEach(([userId, cursor]) => {
    if (!cursor?.position) return;

    const { from, to } = cursor.position;
    const color = cursor.color || '#4f46e5';
    const name = cursor.user?.name || 'Editing...';
    const docSize = doc.content.size;

    // Clamp to valid doc range to prevent crashes
    const safeFrom = Math.min(Math.max(from, 0), docSize);
    const safeTo = Math.min(Math.max(to, 0), docSize);

    // Caret widget
    decorations.push(
      Decoration.widget(safeFrom, () => createCaretElement(name, color), {
        key: `cursor-caret-${userId}`,
        side: -1,
      })
    );

    // Selection highlight
    if (safeFrom !== safeTo) {
      const rangeFrom = Math.min(safeFrom, safeTo);
      const rangeTo = Math.max(safeFrom, safeTo);
      try {
        decorations.push(
          Decoration.inline(rangeFrom, rangeTo, {
            style: `background-color: ${hexToRgba(color, 0.1)};`,
            class: 'remote-selection',
          })
        );
      } catch {
        // Ignore if range crosses nodes illegally
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

function createCaretElement(name, color) {
  const wrapper = document.createElement('span');
  wrapper.className = 'remote-cursor-wrapper';
  wrapper.style.cssText = 'position: relative; display: inline-block;';

  const caret = document.createElement('span');
  caret.className = 'remote-cursor-caret';
  caret.style.cssText = [
    'position: absolute',
    'top: 0',
    'left: -1px',
    'height: 1.2em',
    'width: 2px',
    `background-color: ${color}`,
    'pointer-events: none',
    'opacity: 0.5',
    'z-index: 20',
  ].join(';');

  const label = document.createElement('span');
  label.className = 'remote-cursor-label';
  label.textContent = name;
  label.style.cssText = [
    'position: absolute',
    'top: -1.4em',
    'left: -1px',
    'padding: 2px 6px',
    'border-radius: 4px',
    'border-bottom-left-radius: 0',
    `background-color: ${color}`,
    'color: #fff',
    'font-size: 12px',
    'font-weight: 600',
    'white-space: nowrap',
    'pointer-events: none',
    'opacity: 0.5',
    'z-index: 20',
    'line-height: normal',
    'font-family: sans-serif',
  ].join(';');

  wrapper.appendChild(caret);
  wrapper.appendChild(label);
  return wrapper;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default RemoteCursorsExtension;