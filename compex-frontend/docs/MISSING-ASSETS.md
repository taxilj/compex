# Missing Assets — Compex Solution

## Image Assets

All product/manufacturer/person images in Stitch `code.html` reference:
`https://lh3.googleusercontent.com/aida-public/...`

These are **ephemeral AI-generated images** and will not load in production. They must be replaced before launch.

### Required Images

| Asset | Used In | Replacement Strategy |
|---|---|---|
| Product hero images (6 MCUs) | Product catalog, product detail | Photography or manufacturer datasheets |
| Manufacturer logos (5 mfrs) | Product cards, manufacturer directory | Official brand assets from manufacturer websites |
| Customer logos | Portal dashboard, customer management | Customer-supplied assets |
| Team / person photos | About page, testimonials | Internal HR photos |
| Industry hero images | Industry detail pages | Stock photography (Unsplash/licensed) |

## Fonts

Stitch uses Google Fonts (Inter). Currently loaded via:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
```

For production, self-host with `next/font/google` to avoid FOUT and external dependency.

## Icons

Lucide Icons (`lucide-react`) are installed and used throughout. No missing icon dependencies.

## Status

| Category | Count | Status |
|---|---|---|
| Product images | 6 | PLACEHOLDER (Package icon from Lucide) |
| Manufacturer logos | 5 | PLACEHOLDER (initials box) |
| Customer logos | 8 | PLACEHOLDER (initials box) |
| Vendor logos | 8 | PLACEHOLDER (initials box) |