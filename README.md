# HCMC Map — карта квартир

Интерактивная карта квартир в Хошимине с зонами пешей доступности до школы (Muse Inc).

- Зелёная зона — до 25 минут пешком, жёлтая — 25–35, красная — 35–45.
- Изохроны посчитаны по реальной уличной сети (Valhalla / OpenStreetMap) и лежат в `src/isochrones.json`.
- Квартиры — в `src/apartments.json`, фото — в `public/photos/<id>/`.

## Как добавить квартиру

1. Положить фото в `public/photos/<id>/`
2. Добавить запись в `src/apartments.json`:

```json
{
  "id": "apt-001",
  "title": "Название",
  "price": "10 млн ₫/мес",
  "lat": 10.79,
  "lng": 106.68,
  "address": "адрес",
  "notes": "заметки",
  "link": "https://ссылка-на-объявление",
  "photos": ["photos/apt-001/1.jpg"]
}
```

3. Закоммитить и запушить в `main` — GitHub Actions задеплоит автоматически.

## Локальный запуск

```bash
npm install
npm run dev
```
