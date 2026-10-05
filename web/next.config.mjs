import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// In production nginx routes /api → backend. For `npm run dev` set API_ORIGIN=http://localhost:4000.
export default {
  // Vercel builds Next.js natively; standalone output is reserved for the Docker deployment.
  // The Express API is shared from the repository root, above the Vercel Root Directory (`web`).
  outputFileTracingRoot: path.join(projectDir, '..'),
  outputFileTracingIncludes: {
    '/api/*': ['../src/**/*'],
  },
  async rewrites() {
    return process.env.API_ORIGIN ? [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN}/api/:path*` }] : [];
  },
};
