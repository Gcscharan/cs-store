/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly BASE_URL: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
  readonly VITE_API_URL: string
  readonly VITE_RAZORPAY_KEY_ID: string
  readonly VITE_CLOUDINARY_CLOUD_NAME: string
  readonly VITE_CLOUDINARY_API_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY: string
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_DEV_LOW_POWER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
