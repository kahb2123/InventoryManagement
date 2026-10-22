export const createPortal = (children) => children;
export const flushSync = (fn) => fn();
export const unstable_batchedUpdates = (fn) => fn();
export const findDOMNode = () => null;
export const createRoot = () => ({ render() {}, unmount() {} });
export const hydrateRoot = () => ({ render() {}, unmount() {} });
export default {
  createPortal,
  flushSync,
  unstable_batchedUpdates,
  findDOMNode,
  createRoot,
  hydrateRoot,
};
