/** @type {import('next').NextPolicy} */
const isGithubActions = process.env.GITHUB_ACTIONS || false;

let repo = '';
if (isGithubActions) {
  repo = process.env.GITHUB_REPOSITORY.replace(/.*?\//, '');
}

const assetPrefix = isGithubActions ? `/${repo}/` : '';
const basePath = isGithubActions ? `/${repo}` : '';

const nextConfig = {
  output: 'export',
  assetPrefix: assetPrefix,
  basePath: basePath,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;