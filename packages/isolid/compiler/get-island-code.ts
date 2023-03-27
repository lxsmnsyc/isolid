export default function getIslandCode(id: string, target: string) {
  return `import { $$island } from 'isolid/client';
$$island(${JSON.stringify(id)}, () => import(${JSON.stringify(target)}));`;
}
