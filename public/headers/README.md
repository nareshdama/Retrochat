# Security headers (deployment recipes)

Vite cannot enforce HTTP headers in production by itself—your hosting layer must set them.
Use these snippets as a starting point and **verify CSP in production**.

## Netlify

- Use `public/headers/_headers` as a template (copy to your site root as `_headers`).

## Nginx

- See `public/headers/nginx.conf` for a server block snippet.

## Notes

- Prefer setting CSP as an **HTTP response header**. A CSP `<meta http-equiv>` is a fallback.
- Keep `script-src` **without** `'unsafe-inline'` to block inline scripts.
- Tighten `connect-src` to your exact API/XMTP endpoints when known.

