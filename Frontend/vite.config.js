import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const copyPwaLogo = () => ({
  name: 'copy-pwa-logo',
  async writeBundle(options) {
    await copyFile(
      new URL('assets/LOGO.png', import.meta.url),
      new URL('jockey-logo.png', `file:///${String(options.dir || 'dist').replace(/\\/g, '/')}/`),
    );
  },
});

export default defineConfig({ plugins: [react(), copyPwaLogo()] });
