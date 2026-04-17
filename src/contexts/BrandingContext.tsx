/**
 * Branding コンテキスト
 * App.tsx で resolveBranding() した結果をアプリ全体に配信
 */
import { createContext, useContext } from 'react'
import type { Branding } from '../lib/branding'
import { DIGICOLLAB_DEFAULT_BRANDING } from '../lib/branding'

export const BrandingContext = createContext<Branding>(DIGICOLLAB_DEFAULT_BRANDING)

export function useBranding(): Branding {
  return useContext(BrandingContext)
}
