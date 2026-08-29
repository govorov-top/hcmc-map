# HCMC Apartments Map

Interactive map of apartment listings in Ho Chi Minh City with walk-time zones around the school (Muse Inc).

- Green zone — up to 25 min walk, yellow — 25–35, red — 35–45.
- Isochrones are computed over the real street network (Valhalla / OpenStreetMap) and stored in `src/isochrones.json`.
- Clicking a pin draws walking and bike routes from the school (Valhalla routing API, fetched at runtime).
- Apartments live in `src/apartments.json`, photos in `public/photos/<id>/`.

## Adding an apartment

1. Put photos into `public/photos/<id>/`
2. Add an entry to `src/apartments.json`:

```json
{
  "id": "apt-001",
  "title": "Title",
  "price": "10M ₫/mo",
  "lat": 10.79,
  "lng": 106.68,
  "address": "address",
  "notes": "notes",
  "link": "https://listing-url",
  "photos": ["photos/apt-001/1.jpg"]
}
```

3. Commit and push to `main` — GitHub Actions deploys automatically.

## Local development

```bash
npm install
npm run dev
```
