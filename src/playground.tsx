import { createRoot } from 'react-dom/client';
import { LexicalEditor } from './index';

const App = () => {
  return (
    <div>
      <h1>Lexical Editor Playground</h1>
      <LexicalEditor
        type="json"
        content={{
          "root": {
            "children": [
              {
                "children": [
                  {
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": "Welcome to the Vanilla JS Lexical Demo!",
                    "type": "text",
                    "version": 1
                  }
                ],
                "direction": "ltr",
                "format": "",
                "indent": 0,
                "type": "heading",
                "version": 1,
                "tag": "h1"
              },
              {
                "children": [
                  {
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": "In case you were wondering what the text area at the bottom is – it's the debug view, showing the current state of the editor. ",
                    "type": "text",
                    "version": 1
                  }
                ],
                "direction": "ltr",
                "format": "",
                "indent": 0,
                "type": "quote",
                "version": 1
              },
              {
                "children": [
                  {
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": "This is a demo environment built with ",
                    "type": "text",
                    "version": 1
                  },
                  {
                    "detail": 0,
                    "format": 16,
                    "mode": "normal",
                    "style": "",
                    "text": "lexical",
                    "type": "text",
                    "version": 1
                  },
                  {
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": ". Try typing in ",
                    "type": "text",
                    "version": 1
                  },
                  {
                    "detail": 0,
                    "format": 1,
                    "mode": "normal",
                    "style": "",
                    "text": "some text",
                    "type": "text",
                    "version": 1
                  },
                  {
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": " with ",
                    "type": "text",
                    "version": 1
                  },
                  {
                    "detail": 0,
                    "format": 2,
                    "mode": "normal",
                    "style": "",
                    "text": "different",
                    "type": "text",
                    "version": 1
                  },
                  {
                    "detail": 0,
                    "format": 0,
                    "mode": "normal",
                    "style": "",
                    "text": " formats.",
                    "type": "text",
                    "version": 1
                  }
                ],
                "direction": "ltr",
                "format": "",
                "indent": 0,
                "type": "paragraph",
                "version": 1,
                "textFormat": 0,
                "textStyle": ""
              }
            ],
            "direction": "ltr",
            "format": "",
            "indent": 0,
            "type": "root",
            "version": 1
          }
        }}
        onLoad={(editor) => {
          // @ts-expect-error not error;
          window.__engine = editor;
          console.log('Editor loaded:', editor);
        }}
      />
    </div>
  );
};

export function main() {
  const container = document.getElementById('editor-container');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }
}
