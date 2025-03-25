import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.vitest',
  test: {
    setupFiles: ['src/init-test'],
    environment: 'happy-dom',
    include: ['src/**/*.spec'],
    globals: true,
    restoreMocks: true,
    coverage: {
      // you can include other reporters, but 'json-summary' is required, json is recommended
      reporter: ['text', 'json-summary', 'json'],
      // If you want a coverage reports even if your tests are failing, include the reportOnFailure option
      reportOnFailure: true,
      include: ['../../packages/core/src/**', '../../packages/matroska/src/**'],
    },
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      include: /\.[mc]?[jt]sx?$/,
      // for git+ package only
      exclude: [
        /node_modules\/(?!@konoplayer|\.pnpm)/,
        /node_modules\/\.pnpm\/(?!@konoplayer)/,
      ] as any,
      tsconfigFile: './tsconfig.json',
    }),
  ],
});
