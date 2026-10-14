import { faImage, faSquare, faTableCells, faTableCellsLarge } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import fuzzysort from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import type { ImageLibraryInfo } from '@companion-app/shared/Model/ImageLibraryModel.js'
import { Button, ButtonGroup } from '~/Components/Button.js'
import { CollectionsNestingTable } from '~/Components/CollectionsNestingTable/CollectionsNestingTable.js'
import type { CollectionsNestingTableItem, NestingCollectionsApi } from '~/Components/CollectionsNestingTable/Types.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageThumbnail } from './ImageThumbnail'

type ImageTileSize = 'small' | 'medium' | 'large'

const TILE_SIZES: readonly { size: ImageTileSize; label: string; icon: typeof faImage }[] = [
	{ size: 'small', label: 'Small thumbnails', icon: faTableCells },
	{ size: 'medium', label: 'Medium thumbnails', icon: faTableCellsLarge },
	{ size: 'large', label: 'Large thumbnails', icon: faSquare },
]

interface ImageItem extends CollectionsNestingTableItem {
	imageInfo: ImageLibraryInfo
	fuzzy: Fuzzysort.Prepared
}

interface ImageLibrarySelectorProps {
	selectedImageName: string | null
	onSelectImage: (imageName: string) => void
	/** Pass the real collections API to enable drag-drop reordering. Defaults to read-only. */
	collectionsApi?: NestingCollectionsApi
	/** dragId must be unique across the app's drag-and-drop. Defaults to 'image-library-selector'. */
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
	collectionsApi,
	dragId = 'image-library-selector',
}: ImageLibrarySelectorProps) {
	const { imageLibrary } = useContext(RootAppStoreContext)
	const [searchQuery, setSearchQuery] = useState('')
	const [tileSize, setTileSize] = useLocalStorage<ImageTileSize>('image_library_tile_size', 'medium')

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
			<div className="flex items-center gap-2 pb-2">
				<div className="flex-1 min-w-0">
					<SearchBox placeholder="Search images..." filter={searchQuery} setFilter={setSearchQuery} />
				</div>
				<ButtonGroup>
					{TILE_SIZES.map(({ size, label, icon }) => (
						<Button
							key={size}
							size="sm"
							color="secondary"
							aria-pressed={tileSize === size}
							onClick={() => setTileSize(size)}
							title={label}
							aria-label={label}
							className="h-9"
						>
							<FontAwesomeIcon icon={icon} fixedWidth />
						</Button>
					))}
				</ButtonGroup>
			</div>

			<div className={classNames('image-library-selector-grid', `image-library-tiles-${tileSize}`)}>
				<PanelCollapseHelperProvider storageId="image_library_selector" knownPanelIds={imageLibrary.allCollectionIds}>
					{/* Keyed on the size: the table measures its column count on mount and resize only */}
					<CollectionsNestingTable
						key={tileSize}
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
