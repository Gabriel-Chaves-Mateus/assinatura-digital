import { Html, Head, Main, NextScript } from 'next/document';

const api = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const prod = process.env.NODE_ENV === 'production';

// GitHub Pages não permite cabeçalhos customizados; a CSP vai via <meta>.
// (frame-ancestors não funciona em <meta>; no Docker/nginx o cabeçalho completo é aplicado.)
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next injeta scripts inline de bootstrap
  "style-src 'self' 'unsafe-inline'", // Emotion/MUI injeta estilos
  "img-src 'self' data: blob:",
  `connect-src 'self' ${api}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {prod && <meta httpEquiv="Content-Security-Policy" content={csp} />}
        <meta name="referrer" content="no-referrer" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
