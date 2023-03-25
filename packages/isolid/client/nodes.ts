export function getRoot(id: string): Element {
  const marker = document.querySelector(`isolid-frame[root-id="${id}"] > isolid-root`);
  if (marker) {
    return marker;
  }
  throw new Error(`Missing isolid-frame[root-id="${id}"] > isolid-root`);
}
export function getFragment(id: string): HTMLTemplateElement | null {
  const template = document.querySelector(`isolid-frame[root-id="${id}"] > template`);
  if (template) {
    return template as HTMLTemplateElement;
  }
  throw new Error(`Missing isolid-frame[root-id="${id}"] > template`);
}
