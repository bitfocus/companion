import z from 'zod'
import type { CollectionBase } from './Collections.js'

export const ImageLibraryInfoSchema = z.object({
	name: z.string(),
	description: z.string().default(''),
	originalSize: z.number().default(0),
	previewSize: z.number().default(0),
	createdAt: z.number().default(0),
	/** When the image data was last replaced. Editing the details of an image, or moving it, doesn't count */
	modifiedAt: z.number().default(0),
	checksum: z.string().default(''),
	mimeType: z.string().default(''),
	collectionId: z.string().optional(),
	sortOrder: z.number().default(0),
	/** CSS color string used as the preview background (may be translucent). Undefined is treated as transparent. */
	backgroundColor: z.string().optional(),
})

export type ImageLibraryInfo = z.output<typeof ImageLibraryInfoSchema>

export interface ImageLibraryExportData {
	info: ImageLibraryInfo
	originalImage: string // base64 data URL
	previewImage: string // base64 data URL
}

export type ImageLibraryCollection = CollectionBase<null>

export type ImageLibraryUpdate = ImageLibraryUpdateInitOp | ImageLibraryUpdateRemoveOp | ImageLibraryUpdateUpdateOp

export interface ImageLibraryUpdateInitOp {
	type: 'init'
	images: ImageLibraryInfo[]
}

export interface ImageLibraryUpdateRemoveOp {
	type: 'remove'
	itemName: string
}

export interface ImageLibraryUpdateUpdateOp {
	type: 'update'
	itemName: string
	info: ImageLibraryInfo
}
