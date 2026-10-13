// Preserve the public layout facade without making ordinary resolution import
// incremental metadata fingerprinting and obstacle-invalidation machinery.
export {
  estimateNoteSize,
  resolveAnnotationLayout
} from './layout-resolver.js';
export { createIncrementalAnnotationLayoutSession } from './incremental-layout.js';
export type { AnnotationLayoutSession } from './incremental-layout.js';
