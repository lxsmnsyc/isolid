import * as vite from 'vite';
import solidPlugin from 'vite-plugin-solid';
import isolidPlugin from 'vite-plugin-isolid';

export default vite.defineConfig({
  plugins: [
    isolidPlugin(),
    solidPlugin({
      ssr: true,
    }),
  ],
});
