import React, { createContext, useContext, JSX } from 'react'

/**
 * Simple cache for image URLs to prevent reloading when components are filtered/unfiltered
 */
export class ImageUrlCache {
	private cache = new Map<string, string>()

	/**
	 * Get a cached image URL
	 */
	get(key: string): string | undefined {
		return this.cache.get(key)
	}

	/**
	 * Store an image URL in the cache
	 */
	set(key: string, url: string): void {
		this.cache.set(key, url)
	}

	/**
	 * Remove an image URL from the cache
	 */
	delete(key: string): void {
		this.cache.delete(key)
	}

	/**
	 * Clear the entire cache
	 */
	clear(): void {
		this.cache.clear()
	}

	/**
	 * Clear all cache entries for a specific image ID
	 */
	clearImageName(imageName: string): void {
		const keysToDelete: string[] = []
		for (const key of this.cache.keys()) {
			if (key.startsWith(`${imageName}-`)) {
				keysToDelete.push(key)
			}
		}
		keysToDelete.forEach((key) => this.cache.delete(key))
	}

	/**
	 * Generate a cache key for an image
	 */
	generateKey(imageName: string, type: 'original' | 'preview', checksum: string): string {
		return `${imageName}-${type}-${checksum}`
	}
}

// Create context
const ImageCacheContext = createContext<ImageUrlCache | null>(null)

// Provider component
interface ImageCacheProviderProps {
	cache: ImageUrlCache
}

export function ImageCacheProvider({ children, cache }: React.PropsWithChildren<ImageCacheProviderProps>): JSX.Element {
	return <ImageCacheContext.Provider value={cache}>{children}</ImageCacheContext.Provider>
}

// Hook to use the cache
// eslint-disable-next-line react-refresh/only-export-components
export const useImageCache = (): ImageUrlCache | null => {
	return useContext(ImageCacheContext)
}
