import { Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Grid } from '~/Components/Grid'
import { useTwoPanelMode } from '~/Hooks/useLayoutMode'
import { CloseButton, ContextHelpButton } from '~/Layout/PanelIcons'
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
	const showPrimaryPanel = twoPanelMode || !selectedImageName
	const showSecondaryPanel = twoPanelMode || !!selectedImageName

	return (
		<Grid.Row className="image-library-page split-panels">
			<Grid.Col
				xs={twoPanelMode ? 6 : 12}
				className={classNames('primary-panel', showPrimaryPanel ? 'd-block' : 'd-none')}
			>
				<MyErrorBoundary>
					<ImageLibraryGrid selectedImageName={selectedImageName} onSelectImage={handleSelectImage} />
				</MyErrorBoundary>
			</Grid.Col>

			<Grid.Col xs={twoPanelMode ? 6 : 12} className={`secondary-panel ${showSecondaryPanel ? 'd-block' : 'd-none'}`}>
				<div className="secondary-panel-simple">
					{!!selectedImageName && <ImageEditPanelHeading doClose={doCloseImage} twoPanelMode={twoPanelMode} />}
					<MyErrorBoundary>
						<Outlet />
					</MyErrorBoundary>
				</div>
			</Grid.Col>
		</Grid.Row>
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
