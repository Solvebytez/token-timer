declare module '@vercel/analytics/next' {
  import React from 'react';

  interface AnalyticsProps {
    beforeSend?: (event: any) => any;
    debug?: boolean;
    mode?: 'auto' | 'development' | 'production';
    disableAutoTrack?: boolean;
    scriptSrc?: string;
    endpoint?: string;
    dsn?: string;
  }

  export function Analytics(props: AnalyticsProps): React.ReactElement;
}


