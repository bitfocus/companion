// React 19's types dropped the global `JSX` namespace in favour of `React.JSX`.
// Re-expose it globally so the existing bare `JSX.Element` annotations keep working.
import type { JSX as ReactJSX } from 'react'

declare global {
	namespace JSX {
		type ElementType = ReactJSX.ElementType
		type Element = ReactJSX.Element
		type ElementClass = ReactJSX.ElementClass
		type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
		type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
		type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>
		type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
		type IntrinsicClassAttributes<T> = ReactJSX.IntrinsicClassAttributes<T>
		type IntrinsicElements = ReactJSX.IntrinsicElements
	}
}

// Fix fontsource css imports
declare module '@fontsource/*' {}
declare module '@fontsource-variable/*' {}
