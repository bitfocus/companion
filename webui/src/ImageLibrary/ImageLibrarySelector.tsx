import { faImage } from '@fortawesome/free-solid-svg-icons'
import fuzzysort from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import type { CollectionsNestingTableItem, NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageThumbnail } from './ImageThumbnail'

interface ImageItem extends CollectionsNestingTableItem {
	imageInfo: ImageLibraryInfo
	fuzzy: Fuzzysort.Prepared
}

// No-op api — selector is read-only by default, drag-drop reordering is disabled
const readOnlyCollectionsApi: NestingCollectionsApi = {
	renameCollection: () => {},
	deleteCollection: () => {},
	moveCollection: () => {},
	moveItemToCollection: () => {},
}

interface ImageLibrarySelectorProps {
	selectedImageName: string | null
	onSelectImage: (imageName: string) => void
	/** Pass the real collections API to enable drag-drop reordering. Defaults to read-only. */
	collectionsApi?: NestingCollectionsApi
	/** dragId must be unique per DndProvider scope. Defaults to 'image-library-selector'. */
	dragId?: string
}

/**
 * Reusable image picker — search + collection-grouped thumbnail grid, no management UI.
 * Use this inside modals and other embedded contexts.
 * For the full management page, see ImageLibraryGrid (which uses this component).
 */
export const ImageLibrarySelector = observer(function ImageLibrarySelector({
	selectedImageName,
	onSelectImage,
	collectionsApi = readOnlyCollectionsApi,
	dragId = 'image-library-selector',
}: ImageLibrarySelectorProps) {
	const { imageLibrary } = useContext(RootAppStoreContext)
	const [searchQuery, setSearchQuery] = useState('')

	const images = imageLibrary.getAllImages()

	const imageItems: ImageItem[] = useComputed(
		() =>
			images.map((image) => ({
				id: image.name,
				collectionId: image.collectionId ?? null,
				sortOrder: image.sortOrder,
				imageInfo: image,
				fuzzy: fuzzysort.prepare(`${image.name} ${image.description}`),
			})),
		[images]
	)

	const ItemRow = useCallback(
		(item: ImageItem) => {
			if (searchQuery && fuzzysort.single(searchQuery, item.fuzzy) === null) return null

			return (
				<ImageThumbnail
					image={item.imageInfo}
					selected={selectedImageName === item.id}
					onClick={() => onSelectImage(item.id)}
				/>
			)
		},
		[selectedImageName, onSelectImage, searchQuery]
	)

	return (
		<div className="image-library-selector">
			<div className="pb-2">
				<SearchBox placeholder="Search images..." filter={searchQuery} setFilter={setSearchQuery} />
			</div>

			<div className="image-library-selector-grid">
				<PanelCollapseHelperProvider storageId="image_library_selector" knownPanelIds={imageLibrary.allCollectionIds}>
					<CollectionsNestingTable
						ItemRow={ItemRow}
						itemName="image"
						dragId={dragId}
						collectionsApi={collectionsApi}
						selectedItemId={selectedImageName}
						gridLayout={true}
						collections={imageLibrary.rootCollections()}
						items={imageItems}
						NoContent={NoContent}
					/>
				</PanelCollapseHelperProvider>
			</div>
		</div>
	)
})

function NoContent() {
	return <NonIdealState icon={faImage} text="No images in library" />
}
