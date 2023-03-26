import path from 'path';
import { SplitManifest } from 'isolid/compiler';
import { readFile } from 'fs/promises';
import { outputFile } from './fs';

const ISOLID_DIRECTORY = '.isolid';
const ISOLID_MANIFEST_JSON = `${ISOLID_DIRECTORY}/manifest.json`;

interface RawManifest {
  files: Record<string, string>;
  clients: Record<string, string>;
}

export async function generateManifest(ctx: SplitManifest): Promise<void> {
  const requests: Promise<void>[] = [];

  const fileAliases: Record<string, string> = {};
  const clientAliases: Record<string, string> = {};

  let fileIndex = 0;
  for (const [name, content] of ctx.files) {
    const alias = `.isolid/files/${fileIndex++}${path.extname(name)}`;
    requests.push(outputFile(alias, content, 'utf-8'));
    fileAliases[name] = alias;
  }
  let clientIndex = 0;
  for (const [name, content] of ctx.clients) {
    const alias = `.isolid/clients/${clientIndex++}.js`;
    requests.push(outputFile(alias, content, 'utf-8'));
    clientAliases[name] = alias;
  }

  const manifest: RawManifest = {
    files: fileAliases,
    clients: clientAliases,
  };
  requests.push(outputFile(ISOLID_MANIFEST_JSON, JSON.stringify(manifest), 'utf-8'));
  await Promise.all(requests);
}

export async function getRawManifest(): Promise<RawManifest> {
  const raw = await readFile(ISOLID_MANIFEST_JSON, 'utf-8');
  return JSON.parse(raw) as RawManifest;
}

export function createSplitManifest(): SplitManifest {
  return {
    files: new Map(),
    clients: new Map(),
  };
}

export async function loadManifest(rawManifest: RawManifest): Promise<SplitManifest> {
  const split = createSplitManifest();

  const results: Promise<void>[] = [];

  for (const [name, alias] of Object.entries(rawManifest.files)) {
    results.push(
      readFile(alias, 'utf-8').then((result) => {
        split.files.set(name, result);
      }),
    );
  }
  for (const [name, alias] of Object.entries(rawManifest.clients)) {
    results.push(
      readFile(alias, 'utf-8').then((result) => {
        split.clients.set(name, result);
      }),
    );
  }

  await Promise.all(results);

  return split;
}
export function mergeSplitManifest(source: SplitManifest, target: SplitManifest) {
  for (const [name, content] of target.files) {
    source.files.set(name, content);
  }
  for (const [name, content] of target.clients) {
    source.clients.set(name, content);
  }
}

export function getClientEntryPoints(source: RawManifest): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const [hash, target] of Object.entries(source.clients)) {
    entries[`__isolid/${hash}`] = target;
  }

  return entries;
}
