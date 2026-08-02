import { afterEach } from 'vitest'
import { resetStorageBackend } from '../storage'

/**
 * No localStorage polyfill: storage is a seam whose default is in-memory, so tests get
 * working persistence without a DOM. Resetting between tests is the whole setup.
 */
afterEach(() => {
  resetStorageBackend()
})
