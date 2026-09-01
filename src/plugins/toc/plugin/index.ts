import { $isHeadingNode } from '@lexical/rich-text';
import { $getNodeByKey, type EditorState, type LexicalEditor, type LexicalNode } from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { ITocService, TocPluginOptions, TocService } from '../service';

function $hasHeadingAncestor(node: LexicalNode | null) {
  let current: LexicalNode | null = node;

  while (current) {
    if ($isHeadingNode(current)) {
      return true;
    }

    current = current.getParent();
  }

  return false;
}

function hasHeadingUpdate(
  editorState: EditorState,
  prevEditorState: EditorState,
  dirtyElements: Map<string, boolean>,
  dirtyLeaves: Set<string>,
) {
  const dirtyKeys = new Set([...dirtyElements.keys(), ...dirtyLeaves]);
  if (dirtyKeys.size === 0) return false;
  if (dirtyElements.get('root') === true) return true;

  let hasHeading = false;
  const findHeading = () => {
    for (const key of dirtyKeys) {
      if ($hasHeadingAncestor($getNodeByKey(key))) {
        hasHeading = true;
        return;
      }
    }
  };

  editorState.read(findHeading);
  if (hasHeading) return true;

  prevEditorState.read(findHeading);
  return hasHeading;
}

export const TocPlugin: IEditorPluginConstructor<TocPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<TocPluginOptions>
{
  static pluginName = 'TocPlugin';

  public service: TocService;

  constructor(
    protected kernel: IEditorKernel,
    public config: TocPluginOptions = {},
  ) {
    super();

    this.service = new TocService();
    this.service.setDepthRange(config);
    kernel.registerServiceHotReload(ITocService, this.service);
  }

  onInit(editor: LexicalEditor): void {
    this.service.bindEditor(editor);
    this.service.refresh();

    const refreshOnDocumentChange = this.service.refresh.bind(this.service);

    this.kernel.on('documentChange', refreshOnDocumentChange);
    this.register(() => this.kernel.off('documentChange', refreshOnDocumentChange));
    this.register(
      editor.registerUpdateListener(
        ({ dirtyElements, dirtyLeaves, editorState, prevEditorState }) => {
          if (!hasHeadingUpdate(editorState, prevEditorState, dirtyElements, dirtyLeaves)) {
            return;
          }

          this.service.refresh();
        },
      ),
    );
  }
};
