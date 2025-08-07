import { SendButton, SendButtonProps } from '@lobehub/editor/react';
import { Grid } from '@lobehub/ui';
import { Flexbox } from 'react-layout-kit';

export default () => {
  const menu: SendButtonProps['menu'] = {
    items: [
      {
        key: 'send',
        label: 'Send',
        onClick: () => {
          console.log('Send clicked');
        },
      },
      {
        key: 'send-and-translate',
        label: 'Send and Translate',
        onClick: () => {
          console.log('Send and Translate clicked');
        },
      },
    ],
  };
  return (
    <Flexbox gap={24} width={'100%'}>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton />
        <SendButton type={'default'} />
        <SendButton disabled />
        <SendButton loading />
      </Grid>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton shape={'round'} />
        <SendButton shape={'round'} type={'default'} />
        <SendButton disabled shape={'round'} />
        <SendButton loading shape={'round'} />
      </Grid>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton menu={menu} />
        <SendButton menu={menu} type={'default'} />
        <SendButton disabled menu={menu} />
        <SendButton loading menu={menu} />
      </Grid>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton menu={menu} shape={'round'} />
        <SendButton menu={menu} shape={'round'} type={'default'} />
        <SendButton disabled menu={menu} shape={'round'} />
        <SendButton loading menu={menu} shape={'round'} />
      </Grid>
    </Flexbox>
  );
};
