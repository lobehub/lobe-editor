/* eslint-disable @typescript-eslint/no-use-before-define */
import { LexicalEditor } from 'lexical';
import { type FC, useEffect, useState } from 'react';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { SchemaNode } from '../../node/SchemaNode';
import { ILinkService, LinkService } from '../../service/i-link-service';
import { LinkReactRendererRegistry } from '../renderer-registry';

interface SchemaLinkProps {
  editor: LexicalEditor;
  node: SchemaNode;
  rendererRegistry: LinkReactRendererRegistry;
}

const SchemaLink: FC<SchemaLinkProps> = ({ editor, node, rendererRegistry }) => {
  const service = getKernelFromEditor(editor)?.requireService(ILinkService) as LinkService | null;
  const [, setRendererVersion] = useState(0);
  const url = node.getURL();
  const schema = service?.parseSchemaUrl(url) || null;

  useEffect(() => {
    const handleChange = () => {
      setRendererVersion((version) => version + 1);
    };
    rendererRegistry.on('change', handleChange);
    return () => {
      rendererRegistry.off('change', handleChange);
    };
  }, [rendererRegistry]);

  const props = {
    editor,
    node,
    payload: node.getPayload(),
    schema,
    schemaType: node.getSchemaType(),
    title: node.getTitle(),
    url,
  };

  return (
    rendererRegistry.renderLegacySchemaLink(props) ||
    rendererRegistry.renderSchemaNode(props) || <DefaultSchemaLink {...props} />
  );
};

SchemaLink.displayName = 'SchemaLink';

export default SchemaLink;

function DefaultSchemaLink(props: { schemaType: string; title: string; url: string }) {
  return (
    <a
      href={props.url}
      style={{
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 8,
        color: 'inherit',
        display: 'inline-flex',
        gap: 8,
        padding: '8px 10px',
        textDecoration: 'none',
      }}
    >
      <span>{props.schemaType || 'schema'}</span>
      <strong>{props.title}</strong>
    </a>
  );
}
