import { SendButton, type SendButtonProps } from '@lobehub/editor/react';
import { Grid , Flexbox } from '@lobehub/ui';
import { useTheme } from 'antd-style';

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
export default () => {
  const theme = useTheme();
  return (
    <Flexbox
      gap={24}
      padding={24}
      style={{
        backgroundColor: theme.colorBgContainer,
      }}
      width={'100%'}
    >
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton />
        <SendButton disabled />
        <SendButton loading />
        <SendButton generating />
      </Grid>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton shape={'round'} />
        <SendButton disabled shape={'round'} />
        <SendButton loading shape={'round'} />
        <SendButton generating shape={'round'} />
      </Grid>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton menu={menu} />
        <SendButton disabled menu={menu} />
        <SendButton loading menu={menu} />
        <SendButton generating menu={menu} />
      </Grid>
      <Grid gap={16} maxItemWidth={64} rows={4} width={'100%'}>
        <SendButton menu={menu} shape={'round'} />
        <SendButton disabled menu={menu} shape={'round'} />
        <SendButton loading menu={menu} shape={'round'} />
        <SendButton generating menu={menu} shape={'round'} />
      </Grid>
    </Flexbox>
  );
};
