import { expect } from 'vitest'
import { toMatchImageSnapshot } from './Graphics/helpers/imageSnapshot.js'

expect.extend({ toMatchImageSnapshot })
