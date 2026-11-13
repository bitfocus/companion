import { faAdd, faBook, faImages } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import './image-library.css'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import { Button, LinkButtonExternal } from '~/Components/Button.js'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import type { PageEmptyStateProps } from '~/Layout/PageEmptyState.js'
import { PageHeader } from '~/Layout/PageHeader'
import { PanelHeader } from '~/Layout/PanelHeader.js'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ImageLibraryDropzone } from './ImageLibraryDropzone'
import { ImageLibraryGrid } from './ImageLibraryGrid'
import { useImportImageFiles } from './useImportImageFiles'

const imageLibraryHelpPage = '/user-guide/config/image-library'

export const ImageLibraryPage = observer(function ImageLibraryPage() {
	const matchRoute = useMatchRoute()
	const routeMatch = matchRoute({ to: '/image-library/$imageName' })

	const navigate = useNavigate({ from: '/image-library' })

	const selectedImageName = routeMatch ? routeMatch.imageName : null

	const handleSelectImage = useCallback(
		(imageName: string | null) => {
			if (imageName === null) {
				void navigate({ to: '/image-library' })
			} else {
				void navigate({
					to: `/image-library/$imageName`,
					params: {
						imageName,
					},
				})
			}
		},
		[navigate]
	)

	const doCloseImage = useCallback(() => {
		void navigate({ to: '/image-library' })
	}, [navigate])

	const twoPanelMode = useTwoPanelMode()
	const { imageLibrary } = useContext(RootAppStoreContext)
	const importImages = useImportImageFiles()
	const empty: PageEmptyStateProps | null =
		imageLibrary.count === 0 && imageLibrary.collections.size === 0 && !selectedImageName
			? {
					icon: faImages,
					title: 'No images yet',
					description: (
						<>
							<p>
								The image library stores images to reuse across your buttons, so a logo or icon is uploaded once and
								updated everywhere it is used.
							</p>
							<p>Import images from your computer, or drag and drop them onto this page.</p>
						</>
					),
					actions: (
						<>
							<Button color="primary" onClick={importImages}>
								<FontAwesomeIcon icon={faAdd} className="me-1.5" /> Import images
							</Button>
							<LinkButtonExternal color="secondary" href={makeAbsolutePath(imageLibraryHelpPage)}>
								<FontAwesomeIcon icon={faBook} className="me-1.5" /> Read the guide
							</LinkButtonExternal>
						</>
					),
					notices: <ImageLibraryDropzone />,
				}
			: null

	return (
		<div className="page-shell">
			<PageHeader icon={faImages} title="Image Library" helpAction={imageLibraryHelpPage} />

			<SplitPanels.Root
				empty={empty}
				showing={selectedImageName ? 'secondary' : 'primary'}
				className="image-library-page"
				resize={{ storageKey: 'image-library' }}
			>
				<SplitPanels.Primary>
					<MyErrorBoundary>
						<ImageLibraryGrid selectedImageName={selectedImageName} onSelectImage={handleSelectImage} />
					</MyErrorBoundary>
				</SplitPanels.Primary>

				<SplitPanels.Secondary>
					<div className="secondary-panel-simple">
						{!!selectedImageName && <ImageEditPanelHeading doClose={doCloseImage} twoPanelMode={twoPanelMode} />}
						<MyErrorBoundary>
							<Outlet />
						</MyErrorBoundary>
					</div>
				</SplitPanels.Secondary>
			</SplitPanels.Root>
		</div>
	)
})

interface ImageEditPanelHeadingProps {
	doClose: () => void
	twoPanelMode: boolean
}

function ImageEditPanelHeading({ doClose, twoPanelMode }: ImageEditPanelHeadingProps) {
	return (
		<PanelHeader icon={faImages} title="Edit Image">
			<ContextHelpButton action="/user-guide/config/image-library#editing">Define your image here.</ContextHelpButton>
			{!twoPanelMode && <CloseButton closeFn={doClose} />}
		</PanelHeader>
	)
}
