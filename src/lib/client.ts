import { treaty } from '@elysiajs/eden'
import type { App } from '@/app/api/[[...slugs]]/route'

// Automatically use the current origin (works in both dev and production)
// Use a function to get baseUrl to avoid issues during build
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // During build/SSR, use environment variable or default
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
}

export const client = treaty<App>(getBaseUrl()).api
