import 'react';

// Satır içi stilde CSS özel değişkenleri (`style={{ '--rate': '40%' }}`) tip
// dönüşümü olmadan yazılabilsin.
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
