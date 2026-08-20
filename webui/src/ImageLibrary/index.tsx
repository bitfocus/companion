import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import './image-library.css'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
import { SplitPanels } from '~/Layout/SplitPanels.js'
import { MyErrorBoundary } from '~/Resources/Error'
import { ImageLibraryGrid } from './ImageLibraryGrid'

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

	return (
		<SplitPanels.Root
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
	)
})

interface ImageEditPanelHeadingProps {
	doClose: () => void
	twoPanelMode: boolean
}

function ImageEditPanelHeading({ doClose, twoPanelMode }: ImageEditPanelHeadingProps) {
	return (
		<div className="secondary-panel-simple-header">
			<h4 className="panel-title">Edit Image</h4>
			<div className="header-buttons">
				<ContextHelpButton action="/user-guide/config/image-library#editing">Define your image here.</ContextHelpButton>
				{!twoPanelMode && <CloseButton closeFn={doClose} />}
			</div>
		</div>
	)
}
