import type { ImageSnapshotOptions } from './Graphics/helpers/imageSnapshot.js'
import type { Canvas } from '@napi-rs/canvas'

declare module 'vitest' {
	interface Assertion {
		toMatchImageSnapshot(name?: string, options?: ImageSnapshotOptions): Promise<void>
	}
}

// Make this a module so the declaration above is treated as an augmentation
export type { Canvas, ImageSnapshotOptions }
