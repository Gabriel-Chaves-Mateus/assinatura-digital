/** Exportação estática => publicável no GitHub Pages (HTTPS/TLS fornecido pelo GitHub). */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

module.exports = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
