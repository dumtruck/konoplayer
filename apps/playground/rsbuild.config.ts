import { defineConfig } from '@rsbuild/core';

export default defineConfig({

  html: {
    title: 'Konoplayer Playground',
    template: './src/index.html',
  },
  source: {
    decorators: {
      version: 'legacy',
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
  },
});
