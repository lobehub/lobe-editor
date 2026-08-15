import {
  type LinkEmbedRule,
  ReactEditor,
  ReactEditorContent,
  ReactLinkPlugin,
  ReactPlainText,
  type SchemaRule,
} from '@lobehub/editor';
import { createStaticStyles } from 'antd-style';

import content from './data.json';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    display: inline-flex;
    gap: 4px;
    align-items: center;

    max-width: min(320px, 100%);
    padding-block: 0;
    padding-inline: 2px;

    line-height: 1;
    color: ${cssVar.colorLink};
    text-decoration: none;
    vertical-align: baseline;

    &[data-selected='true'] {
      border-radius: 5px;
      outline: 2px solid ${cssVar.colorPrimaryBorder};
      outline-offset: 1px;
    }

    &:hover {
      color: ${cssVar.colorLinkHover};
      text-decoration: none;
    }
  `,
  icon: css`
    position: relative;
    inset-block-start: 0.06em;

    overflow: hidden;
    display: grid;
    flex: none;
    place-items: center;

    width: 1.1em;
    height: 1.1em;
    border-radius: 5px;

    font-size: 11px;
    line-height: 1;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillQuaternary};

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
  iframe: css`
    position: relative;

    overflow: hidden;

    width: 100%;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    &[data-selected='true'],
    &:focus,
    &:focus-within {
      border-color: ${cssVar.colorPrimary};
      outline: none;
      box-shadow: 0 0 0 2px ${cssVar.colorPrimaryBg};
    }
  `,
  iframeLoading: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;

    height: 320px;

    font-size: 13px;
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillQuaternary};
  `,
  iframeSpinner: css`
    width: 14px;
    height: 14px;
    border: 2px solid ${cssVar.colorBorderSecondary};
    border-block-start-color: ${cssVar.colorPrimary};
    border-radius: 50%;

    animation: lobe-link-iframe-spin 1s linear infinite;

    @keyframes lobe-link-iframe-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  iframeTitle: css`
    padding-block: 8px;
    padding-inline: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
  schema: css`
    display: inline-grid;
    gap: 4px;

    padding-block: 8px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 8px;

    background: ${cssVar.colorFillQuaternary};
  `,
  title: css`
    overflow: hidden;
    display: inline-block;

    min-width: 0;

    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
}));

const amapIcon =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 rx=%2210%22 fill=%22%23f6fbff%22/%3E%3Cpath d=%22M8 24 40 8 27 40l-5-13-14-3Z%22 fill=%22%231677ff%22/%3E%3Cpath d=%22m22 27 18-19-13 32-5-13Z%22 fill=%22%2300b96b%22 opacity=%22.82%22/%3E%3Cpath d=%22M8 24 40 8 19 29l3-2-14-3Z%22 fill=%22%2369c0ff%22/%3E%3C/svg%3E';

const amapRule: LinkEmbedRule = {
  allowCard: true,
  allowIframe: true,
  getCardPayload: (url) => ({
    icon: amapIcon,
    title: '高德地图',
    url,
  }),
  getIframePayload: (url) => ({
    src: url,
    title: 'Amap embed',
    url,
  }),
  id: 'amap-share',
  match: (url) => /(^https?:\/\/)?(uri\.amap\.com|amap\.com)\//.test(url),
};

const genericWebRule: LinkEmbedRule = {
  allowCard: true,
  allowIframe: true,
  getCardPayload: (url, context) => ({
    description: url,
    title: context.title || url,
    url,
  }),
  id: 'generic-web',
  match: (url) => /^https?:\/\//.test(url),
};

const schemaRules: SchemaRule[] = [
  {
    id: 'schema-card',
    match: (url) => url.startsWith('schema://'),
    parse: (url, schema) => ({
      payload: schema,
      schemaType: schema?.host || 'schema',
      title: `Schema ${schema?.pathname || url}`,
      url,
    }),
  },
  {
    id: 'alipay',
    match: (url) => url.startsWith('alipay://'),
    parse: (url, schema) => ({
      payload: schema,
      schemaType: 'alipay',
      title: 'Alipay schema action',
      url,
    }),
  },
];

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactLinkPlugin
        allowedProtocols={['schema:', 'alipay:']}
        labels={{
          convertToCard: 'Card',
          convertToIframe: 'Iframe',
          convertToLink: 'Link',
          convertToSchema: 'Schema',
        }}
        linkEmbedRules={[amapRule, genericWebRule]}
        renderLinkCard={({
          icon,
          isSelected,
          onClickCapture,
          onMouseDownCapture,
          openTarget,
          title,
          url,
        }) => (
          <a
            className={styles.card}
            data-selected={isSelected}
            href={url}
            onClickCapture={onClickCapture}
            onMouseDownCapture={onMouseDownCapture}
            rel="noreferrer"
            target={openTarget || '_blank'}
          >
            <span aria-hidden className={styles.icon}>
              {icon ? <img alt="" src={icon} /> : title.slice(0, 1).toUpperCase()}
            </span>
            <span className={styles.title}>{title}</span>
          </a>
        )}
        renderLinkIframe={({ isLoading, isSelected, onLoad, onMouseDownCapture, src, title }) => (
          <div className={styles.iframe} data-selected={isSelected} tabIndex={0}>
            <div className={styles.iframeTitle} onMouseDownCapture={onMouseDownCapture}>
              {title}
            </div>
            {isLoading && (
              <div className={styles.iframeLoading}>
                <span className={styles.iframeSpinner} />
                Loading embed...
              </div>
            )}
            <iframe
              height={320}
              onLoad={onLoad}
              src={src}
              style={{ border: 0, display: isLoading ? 'none' : 'block', width: '100%' }}
              title={title}
            />
          </div>
        )}
        renderSchema={({ payload, schema, schemaType, title, url }) => (
          <div className={styles.schema}>
            <strong>{title}</strong>
            <span>{schemaType}</span>
            <code>{schema?.protocol || url}</code>
            <small>{JSON.stringify(payload)}</small>
          </div>
        )}
        schemaRules={schemaRules}
      />
    </ReactEditor>
  );
};
