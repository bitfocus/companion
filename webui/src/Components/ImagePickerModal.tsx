import { faFolderOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { humanId } from 'human-id'
import { observer } from 'mobx-react-lite'
import { forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { isLabelValid } from '@companion-app/shared/Label.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { Button } from '~/Components/Button.js'
import { FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { blobToDataURL } from '~/Helpers/FileUpload.js'
import { ImageLibrarySelector } from '~/ImageLibrary/ImageLibrarySelector.js'
import { ImageNameInput } from '~/ImageLibrary/ImageNameInput.js'
import { ImagePreviewBox } from '~/ImageLibrary/ImagePreviewBox.js'
import { useImageLibraryUpload } from '~/ImageLibrary/useImageLibraryUpload.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { DismissableAlert } from './Alert.js'

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

interface MinMaxDimension {
	width: number
	height: number
}

export interface ImagePickerModalRef {
	show(initialTab?: TabKey): void
}

interface ImagePickerModalProps {
	setValue: (value: string | null) => void
	min?: MinMaxDimension
	max?: MinMaxDimension
}

type TabKey = 'library' | 'upload' | 'custom'

export const ImagePickerModal = observer(
	forwardRef<ImagePickerModalRef, ImagePickerModalProps>(function ImagePickerModal({ setValue, min, max }, ref) {
		const [open, setOpen] = useState(false)
		const [activeTab, setActiveTab] = useState<TabKey>('library')

		useImperativeHandle(
			ref,
			() => ({
				show(initialTab: TabKey = 'library') {
					setActiveTab(initialTab)
					setOpen(true)
				},
			}),
			[]
		)

		const handleLibrarySelect = useCallback(
			(imageName: string | null) => {
				if (imageName) {
					setValue(`$(image:${imageName})`)
				}
				setOpen(false)
			},
			[setValue]
		)

		const handleCustomSelect = useCallback(
			(dataUrl: string | null) => {
				setValue(dataUrl)
				setOpen(false)
			},
			[setValue]
		)

		return (
			<Modal.Root open={open} onOpenChange={setOpen}>
				<Modal.Portal>
					<Modal.Backdrop />
					<Modal.Viewport>
						<Modal.Popup style={{ width: '800px', maxWidth: '95vw' }}>
							<Modal.Header closeButton>
								<Modal.Title>Select Image</Modal.Title>
							</Modal.Header>
							<Modal.Body style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
								<TabArea.Root value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
									<TabArea.List>
										<TabArea.Tab value="library">Library</TabArea.Tab>
										<TabArea.Tab value="upload">Upload to Library</TabArea.Tab>
										<TabArea.Tab value="custom">Custom</TabArea.Tab>
										<TabArea.Indicator />
									</TabArea.List>

									<TabArea.Panel value="library" style={{ flex: 1 }}>
										<ImageLibrarySelector selectedImageName={null} onSelectImage={handleLibrarySelect} />
									</TabArea.Panel>

									<TabArea.Panel value="upload">
										<UploadToLibraryTab onComplete={handleLibrarySelect} />
									</TabArea.Panel>

									<TabArea.Panel value="custom">
										<CustomImageTab onComplete={handleCustomSelect} min={min} max={max} />
									</TabArea.Panel>
								</TabArea.Root>
							</Modal.Body>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		)
	})
)

interface UploadToLibraryTabProps {
	onComplete: (imageName: string) => void
}

const UploadToLibraryTab = observer(function UploadToLibraryTab({ onComplete }: UploadToLibraryTabProps) {
	const { notifier } = useContext(RootAppStoreContext)
	const [selectedFile, setSelectedFile] = useState<File | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [description, setDescription] = useState('')
	const [imageName, setImageName] = useState(() => humanId({ separator: '-', capitalize: false }))
	const [isUploading, setIsUploading] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const createMutation = useMutationExt(trpc.imageLibrary.create.mutationOptions())
	const { uploadImageFile } = useImageLibraryUpload()

	const handleFileClick = useCallback(() => {
		setErrorMessage(null)
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
			fileInputRef.current.click()
		}
	}, [])

	const handleFile = useCallback((file: File) => {
		if (!allowedImageTypes.includes(file.type)) {
			setErrorMessage('Only PNG, JPEG, GIF, WebP or SVG files are supported.')
			return
		}
		setSelectedFile(file)
		const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
		setDescription(nameWithoutExt)
		setPreviewUrl(URL.createObjectURL(file))
		setErrorMessage(null)
	}, [])

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.currentTarget.files?.[0]
			if (!file) return
			handleFile(file)
		},
		[handleFile]
	)

	const handleUpload = useCallback(() => {
		if (!selectedFile) return
		if (!description.trim()) {
			setErrorMessage('Description is required.')
			return
		}
		if (!isLabelValid(imageName)) {
			setErrorMessage('Image ID is invalid.')
			return
		}

		setIsUploading(true)
		setErrorMessage(null)

		createMutation
			.mutateAsync({ name: imageName, description: description.trim() })
			.then(async () => {
				await uploadImageFile(selectedFile, imageName)
				onComplete(imageName)
			})
			.catch((err) => {
				console.error('Failed to upload image to library:', err)
				setErrorMessage(stringifyError(err) || 'Upload failed.')
				notifier.show('Upload Failed', 'Failed to upload image to library.', 5000)
			})
			.finally(() => {
				setIsUploading(false)
			})
	}, [selectedFile, description, imageName, createMutation, uploadImageFile, onComplete, notifier])

	const canUpload = !!selectedFile && description.trim() !== '' && isLabelValid(imageName) && !isUploading

	return (
		<div className="d-flex flex-column gap-3 pt-3">
			<DismissableAlert color="warning" visible={!!errorMessage} onClose={() => setErrorMessage(null)}>
				{errorMessage}
			</DismissableAlert>

			<ImageNameInput value={imageName} onChange={setImageName} disabled={isUploading} />

			<div className="mb-3 row">
				<FormLabel htmlFor="upload-description" className="col-sm-3 col-form-label">
					Description
				</FormLabel>
				<div className="col-sm-9">
					<TextInputFieldSimple
						id="upload-description"
						value={description}
						setValue={setDescription}
						disabled={isUploading}
					/>
				</div>
			</div>

			<div>
				<Button color="primary" onClick={handleFileClick} disabled={isUploading}>
					<FontAwesomeIcon icon={faFolderOpen} /> Choose File
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="d-none"
					onChange={handleFileChange}
					disabled={isUploading}
				/>
			</div>

			<ImagePreviewBox src={previewUrl} onFileDrop={handleFile} dragOverMessage="Drop image to preview" />

			<div>
				<Button color="primary" onClick={handleUpload} disabled={!canUpload}>
					{isUploading ? 'Uploading…' : 'Upload to Library'}
				</Button>
			</div>
		</div>
	)
})

interface CustomImageTabProps {
	onComplete: (dataUrl: string | null) => void
	min?: MinMaxDimension
	max?: MinMaxDimension
}

function CustomImageTab({
	onComplete,
	min = { width: 8, height: 8 },
	max = { width: 400, height: 400 },
}: CustomImageTabProps) {
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const apiIsSupported = !!(window.File && window.FileReader && window.FileList && window.Blob)

	const imageResize = useCallback(
		(img: HTMLImageElement): string => {
			const canvas = document.createElement('canvas')
			let width = img.width
			let height = img.height

			if (width >= height) {
				if (width > max.width) {
					height *= max.width / width
					width = max.width
				}
			} else {
				if (height > max.height) {
					width *= max.height / height
					height = max.height
				}
			}

			canvas.width = width
			canvas.height = height
			const ctx = canvas.getContext('2d')
			if (!ctx) throw new Error('Canvas not supported')
			ctx.drawImage(img, 0, 0, width, height)
			return canvas.toDataURL()
		},
		[max]
	)

	const handleFileClick = useCallback(() => {
		setErrorMessage(null)
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
			fileInputRef.current.click()
		}
	}, [])

	const handleFile = useCallback(
		(file: File) => {
			if (!allowedImageTypes.includes(file.type)) {
				setErrorMessage('Only PNG, JPEG, GIF, WebP or SVG files are supported.')
				return
			}

			Promise.resolve()
				.then(async () => {
					const imageSourceStr = await blobToDataURL(file)
					const img = new Image()
					img.onload = () => {
						if (max && (img.height > max.height || img.width > max.width)) {
							setPendingDataUrl(imageResize(img))
						} else if (min && (img.width < min.width || img.height < min.height)) {
							setErrorMessage(`Image dimensions must be at least ${min.width}×${min.height}`)
						} else {
							setPendingDataUrl(imageSourceStr)
						}
					}
					img.src = imageSourceStr
				})
				.catch((err) => {
					setErrorMessage(`Error reading file: ${err}`)
				})
		},
		[min, max, imageResize]
	)

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.currentTarget.files?.[0]
			if (!file) return
			handleFile(file)
		},
		[handleFile]
	)

	const handleUseImage = useCallback(() => {
		if (pendingDataUrl) {
			onComplete(pendingDataUrl)
		}
	}, [pendingDataUrl, onComplete])

	return (
		<div className="d-flex flex-column gap-3 pt-3">
			<p className="text-muted mb-0">
				This image will be stored only for this field and will not appear in the image library.
			</p>

			<DismissableAlert color="warning" visible={!!errorMessage} onClose={() => setErrorMessage(null)}>
				{errorMessage}
			</DismissableAlert>

			<div>
				<Button color="primary" onClick={handleFileClick} disabled={!apiIsSupported}>
					<FontAwesomeIcon icon={faFolderOpen} /> Choose File
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="d-none"
					onChange={handleFileChange}
					disabled={!apiIsSupported}
				/>
			</div>

			<ImagePreviewBox src={pendingDataUrl} onFileDrop={handleFile} dragOverMessage="Drop image to preview" />

			<div>
				<Button color="primary" disabled={!pendingDataUrl} onClick={handleUseImage}>
					Use This Image
				</Button>
			</div>
		</div>
	)
}
