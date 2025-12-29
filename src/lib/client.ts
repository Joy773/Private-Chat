import { treaty } from '@elysiajs/eden'
import type { App } from '@/app/api/[[...slugs]]/route'

// Automatically use the current origin (works in both dev and production)
const baseUrl = typeof window !== 'undefined' 
  ? window.location.origin 
  : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export const client = treaty<App>(baseUrl).api
