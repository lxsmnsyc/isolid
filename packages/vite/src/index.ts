import isolidCompiler, { SplitManifest } from 'isolid/compiler';
import { normalizePath, Plugin } from 'vite';
import { createFilter, FilterPattern } from '@rollup/pluginutils';
import path from 'path';
import {
  createSplitManifest,
  generateManifest,
  getClientEntryPoints,
  getRawManifest,
  loadManifest,
  mergeSplitManifest,
} from './manifest';

export interface IsolidPluginFilter {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export interface IsolidPluginOptions {
  filter?: IsolidPluginFilter;
}

// From: https://github.com/bluwy/whyframe/blob/master/packages/jsx/src/index.js#L27-L37
function repushPlugin(plugins: Plugin[], plugin: Plugin, pluginNames: string[]) {
  const namesSet = new Set(pluginNames);

  let baseIndex = -1;
  let targetIndex = -1;
  for (let i = 0, len = plugins.length; i < len; i += 1) {
    const current = plugins[i];
    if (namesSet.has(current.name) && baseIndex === -1) {
      baseIndex = i;
    }
    if (current.name === plugin.name) {
      targetIndex = i;
    }
  }
  if (baseIndex !== -1 && targetIndex !== -1 && baseIndex < targetIndex) {
    plugins.splice(targetIndex, 1);
    plugins.splice(baseIndex, 0, plugin);
  }
}

const DEFAULT_INCLUDE = 'src/**/*.{jsx,tsx,ts,js,mjs,cjs}';
const DEFAULT_EXCLUDE = 'node_modules/**/*.{jsx,tsx,ts,js,mjs,cjs}';

export default function isolidPlugin(
  options: IsolidPluginOptions = {},
): Plugin[] {
  const filter = createFilter(
    options.filter?.include || DEFAULT_INCLUDE,
    options.filter?.exclude || DEFAULT_EXCLUDE,
  );

  let manifest: SplitManifest;

  const prePlugin: Plugin = {
    name: 'isolid-split',
    enforce: 'pre',
    async config(config, env) {
      config.build = config.build || {};
      config.build.rollupOptions = config.build.rollupOptions || {};

      if (env.ssrBuild) {
        manifest = createSplitManifest();
      } else {
        const rawManifest = await getRawManifest();
        config.build.rollupOptions.input = Object.assign(
          config.build.rollupOptions.input || {},
          getClientEntryPoints(rawManifest),
        );
        manifest = await loadManifest(rawManifest);

        if (!Array.isArray(config.build.rollupOptions.output)) {
          const prev = config.build.rollupOptions.output;
          config.build.rollupOptions.output = [];
          if (prev) {
            config.build.rollupOptions.output.push(prev);
          }
        }

        config.build.rollupOptions.output.push({
          entryFileNames(chunkInfo) {
            return `${chunkInfo.name}.js`;
          },
        });
      }
    },
    configResolved(config) {
      // run our plugin before the following plugins:
      repushPlugin(config.plugins as Plugin[], prePlugin, [
        // https://github.com/withastro/astro/blob/main/packages/astro/src/vite-plugin-jsx/index.ts#L173
        'astro:jsx',
        // https://github.com/solidjs/vite-plugin-solid/blob/master/src/index.ts#L305
        'solid',
      ]);
    },
    configureServer(server) {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      server.middlewares.use(async (req, res, next) => {
        if (req.url && /^\/__isolid/i.test(req.url)) {
          const normalized = normalizePath(process.cwd());
          const target = path.join('/@fs/', normalized, req.url);
          const value = await server.transformRequest(target, { ssr: false });
          res.setHeader('content-type', 'text/javascript');
          next();
          res.write(value?.code);
          res.end();
        } else {
          next();
        }
      });
    },
    load(id) {
      if (id.startsWith('\0')) {
        return null;
      }
      if (/\?isolid/i.test(id)) {
        const replaced = id.split('/').join(path.sep);
        return manifest.files.get(replaced);
      }
      if (/__isolid/i.test(id)) {
        const resolved = path.parse(id).name;
        return manifest.clients.get(resolved);
      }
      return null;
    },
    async transform(code, id, opts) {
      if (id.startsWith('\0')) {
        return null;
      }
      if (!filter(id)) {
        return code;
      }
      if (!/\?isolid/i.test(id) && opts?.ssr) {
        const split = await isolidCompiler.split(id, code, {
          mode: 'server',
        });

        mergeSplitManifest(manifest, split);

        return {
          code: split.code || undefined,
          map: split.map || undefined,
        };
      }

      return code;
    },
    async generateBundle() {
      await generateManifest(manifest);
    },
  };

  const postPlugin: Plugin = {
    name: 'isolid-compile',
    async transform(code, id, opts) {
      if (filter(id)) {
        const result = await isolidCompiler.compile(id, code, {
          mode: opts?.ssr ? 'server' : 'client',
        });

        return {
          code: result.code || undefined,
          map: result.map || undefined,
        };
      }
      return code;
    },
  };

  return [prePlugin, postPlugin];
}
