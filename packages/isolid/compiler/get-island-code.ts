export default function getIslandCode(target: string) {
  return `import{$$island}from'isolid/client';export default $$island(()=>import(${JSON.stringify(target)}))`;
}
