import { $createParagraphNode, $createTextNode, $getRoot, $isElementNode } from 'lexical';
import { Doc } from 'yjs';

import {
  createHeadlessCollaborationContext,
  getLexicalTextLeafAtOffset,
} from '../examples/ai-collaboration-demo/server/aiActor';

const waitForCollaboration = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const readText = (context: ReturnType<typeof createHeadlessCollaborationContext>) => {
  let text = '';
  context.lexicalEditor.getEditorState().read(() => {
    text = $getRoot().getTextContent();
  });
  return text;
};

describe('AI headless collaboration actor', () => {
  it('round-trips Lexical updates between two headless editors on one Y.Doc', async () => {
    const doc = new Doc();
    const writer = createHeadlessCollaborationContext('headless-round-trip', doc, {
      shouldBootstrap: true,
    });
    const reader = createHeadlessCollaborationContext('headless-round-trip', doc);

    try {
      writer.lexicalEditor.update(
        () => {
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Written by the AI actor'));
          $getRoot().clear().append(paragraph);
        },
        { discrete: true },
      );

      await waitForCollaboration();
      expect(readText(reader)).toBe('Written by the AI actor');

      reader.lexicalEditor.getEditorState().read(() => {
        const documentEnd = $getRoot().getTextContent().length;
        expect(getLexicalTextLeafAtOffset(documentEnd)).toBeDefined();
        expect(getLexicalTextLeafAtOffset(documentEnd + 1)).toBeUndefined();
      });

      reader.lexicalEditor.update(
        () => {
          const paragraph = $getRoot().getLastChild();
          if (!$isElementNode(paragraph)) throw new Error('Missing synchronized paragraph');
          paragraph.append($createTextNode(' and merged by its peer'));
        },
        { discrete: true },
      );

      await waitForCollaboration();
      expect(readText(writer)).toBe('Written by the AI actor and merged by its peer');
    } finally {
      writer.cleanup();
      reader.cleanup();
      doc.destroy();
    }
  });
});
