/* eslint-disable @typescript-eslint/no-use-before-define */
import EventEmitter from 'eventemitter3';
import type { LexicalEditor } from 'lexical';
import type { FC, MouseEventHandler, ReactEventHandler, ReactNode } from 'react';

import type { LinkCardNode } from '../node/LinkCardNode';
import type { LinkIframeNode } from '../node/LinkIframeNode';
import type { LinkNode } from '../node/LinkNode';
import type { SchemaNode } from '../node/SchemaNode';
import type { ParsedSchemaUrl, SchemaRule } from '../service/i-link-service';
import { normalizeProtocol } from '../service/i-link-service';

export interface LinkCardRendererProps {
  description: string;
  editor: LexicalEditor;
  icon: string;
  isSelected: boolean;
  node: LinkCardNode;
  onClickCapture: MouseEventHandler<HTMLElement>;
  onMouseDownCapture: MouseEventHandler<HTMLElement>;
  openTarget: null | string;
  title: string;
  url: string;
}

export interface LinkIframeRendererProps {
  editor: LexicalEditor;
  isEditable: boolean;
  isLoading: boolean;
  isSelected: boolean;
  node: LinkIframeNode;
  onLoad: ReactEventHandler<HTMLIFrameElement>;
  onMouseDownCapture: MouseEventHandler<HTMLElement>;
  src: string;
  title: string;
  url: string;
}

export interface SchemaRendererProps {
  editor: LexicalEditor;
  node: SchemaNode;
  payload: unknown;
  schema: ParsedSchemaUrl | null;
  schemaType: string;
  title: string;
  url: string;
}

export type LinkCardRenderer = (props: LinkCardRendererProps) => ReactNode;
export type LinkIframeRenderer = (props: LinkIframeRendererProps) => ReactNode;
export type SchemaRenderer = (props: SchemaRendererProps) => ReactNode;

export interface SchemaLinkRendererProps {
  editor: LexicalEditor;
  node: LinkNode;
  rel: null | string;
  schema: ParsedSchemaUrl | null;
  target: null | string;
  text: string;
  title: null | string;
  url: string;
}

export type SchemaLinkRenderer = (props: SchemaLinkRendererProps) => ReactNode;

/** @deprecated Use schemaRules/renderSchema with SchemaNode instead. */
export interface SchemaLinkRendererConfig {
  protocol: string;
  render: SchemaLinkRenderer;
}

export interface ReactSchemaRule extends SchemaRule {
  render?: SchemaRenderer;
}

export interface LinkToolbarAction {
  icon?: FC<any>;
  key: string;
  label: string;
  onClick: (context: {
    editor: LexicalEditor;
    node: LinkNode | LinkCardNode | LinkIframeNode | SchemaNode;
  }) => void;
  visible?: (context: {
    editor: LexicalEditor;
    node: LinkNode | LinkCardNode | LinkIframeNode | SchemaNode;
  }) => boolean;
}

export interface LinkReactRendererConfig {
  renderLinkCard?: LinkCardRenderer;
  renderLinkIframe?: LinkIframeRenderer;
  renderSchema?: SchemaRenderer;
  schemaLinkRenderers?: SchemaLinkRendererConfig[];
  schemaRenderers?: Map<string, SchemaRenderer>;
}

export class LinkReactRendererRegistry extends EventEmitter<'change'> {
  private renderCard?: LinkCardRenderer;
  private renderIframe?: LinkIframeRenderer;
  private renderSchema?: SchemaRenderer;
  private schemaLinkRenderers = new Map<string, SchemaLinkRenderer>();
  private schemaRenderers = new Map<string, SchemaRenderer>();

  update(config?: LinkReactRendererConfig): void {
    this.renderCard = config?.renderLinkCard;
    this.renderIframe = config?.renderLinkIframe;
    this.renderSchema = config?.renderSchema;
    this.schemaRenderers = config?.schemaRenderers || new Map();
    this.schemaLinkRenderers = new Map(
      (config?.schemaLinkRenderers || []).map(({ protocol, render }) => [
        normalizeProtocol(protocol),
        render,
      ]),
    );
    this.emit('change');
  }

  renderCardNode(props: LinkCardRendererProps): ReactNode {
    return this.renderCard?.(props) || null;
  }

  renderIframeNode(props: LinkIframeRendererProps): ReactNode {
    return this.renderIframe?.(props) || null;
  }

  renderSchemaNode(props: SchemaRendererProps): ReactNode {
    return (
      this.schemaRenderers.get(props.schemaType)?.(props) || this.renderSchema?.(props) || null
    );
  }

  renderLegacySchemaLink(props: SchemaRendererProps): ReactNode {
    const renderer = this.getSchemaLinkRenderer(props.url);
    if (!renderer) return null;
    const legacy = getLegacyLinkPayload(props.payload);
    return renderer({
      editor: props.editor,
      node: props.node as unknown as LinkNode,
      rel: legacy.rel,
      schema: props.schema,
      target: legacy.target,
      text: legacy.text || props.title,
      title: legacy.title || props.title,
      url: props.url,
    });
  }

  private getSchemaLinkRenderer(url: string): SchemaLinkRenderer | null {
    try {
      const { protocol } = new URL(url);
      return this.schemaLinkRenderers.get(protocol) || null;
    } catch {
      return null;
    }
  }
}

export function splitReactSchemaRules(rules?: ReactSchemaRule[]): {
  coreRules?: SchemaRule[];
  schemaRenderers: Map<string, SchemaRenderer>;
} {
  if (!rules) {
    return { schemaRenderers: new Map() };
  }

  const schemaRenderers = new Map<string, SchemaRenderer>();
  const coreRules = rules.map(({ render, ...rule }) => {
    if (render) schemaRenderers.set(rule.id, render);
    return rule;
  });

  return { coreRules, schemaRenderers };
}

function getLegacyLinkPayload(payload: unknown): {
  rel: null | string;
  target: null | string;
  text: string;
  title: null | string;
} {
  if (payload && typeof payload === 'object' && '__legacyLink' in payload) {
    const legacy = (payload as { __legacyLink?: Record<string, unknown> }).__legacyLink;
    return {
      rel: typeof legacy?.rel === 'string' ? legacy.rel : null,
      target: typeof legacy?.target === 'string' ? legacy.target : null,
      text: typeof legacy?.text === 'string' ? legacy.text : '',
      title: typeof legacy?.title === 'string' ? legacy.title : null,
    };
  }

  return {
    rel: null,
    target: null,
    text: '',
    title: null,
  };
}
