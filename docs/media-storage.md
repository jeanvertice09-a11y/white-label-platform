# Media storage activation

The application uses Cloudflare R2 through server-generated AWS SigV4 presigned URLs. No R2 secret is sent to the browser.

## Required server environment

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_MEDIA`
- `R2_PUBLIC_BASE_URL`

`R2_PUBLIC_BASE_URL` must point to the public/custom domain serving the configured media bucket. With the current storefront contract it must be `https://media.kataluu.com.br`.

If any required variable is missing, upload intent creation fails closed with an operational configuration error; the application never reports a successful upload.

## R2 bucket requirements

The bucket must allow browser `PUT` requests from the actual Admin/Control origins through its CORS policy, with the `Content-Type` request header allowed. Keep write credentials server-side only. Public reads are served from `R2_PUBLIC_BASE_URL`; bucket listing does not need to be public.

## Lifecycle

1. Server resolves the authenticated tenant/store and creates a `media_assets` row plus a short-lived presigned PUT URL.
2. Browser uploads directly to that exact random key using the authorized MIME.
3. Server finalization performs signed R2 `HEAD` and range `GET` checks, validating size, MIME and binary image signature.
4. Only a `ready` asset from the same scope can be associated to product images, banners or the tenant logo.
5. On detach/replacement, physical deletion is attempted only after all database references reach zero. Failed cleanup remains tracked for retry.
6. Expired pending uploads and finalized-but-unreferenced assets older than 24 hours are collected opportunistically before later upload intents.

Original-image upload is implemented. `media.process` remains intentionally unimplemented until a real transformation/queue pipeline exists.
