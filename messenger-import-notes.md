# Messenger import — notes & open questions (2026-09-03)

Crawled every apartment-related chat in Messenger and added the new offers to
`src/apartments.json` (entries **apt-027 … apt-064**, 38 new listings from 15 new
agents + new listings from 3 already-listed agents). Existing apt-001…026 were left
untouched. Review the diff, then we can push to deploy.

## How photos & locations were handled (per your choices)
- **Photos**: only pulled where a listing link existed — the **6 JHouse.vn listings**
  (apt-027–030, 048, 049) have full photo galleries + exact coordinates from the
  listing's map. Everything else had photos only inside the chat → added with text +
  location, **no photos yet** (`photos: []`). We can add those later.
- **Coordinates**: JHouse + The Manor = exact. Everything else is geocoded to
  street/ward level or placed from the address and marked **`approx: true`** (the pin
  shows the `?`/`!` "approximate location" warning on the map). Worth spot-checking the
  approximate ones before relying on the walk-zone colour.
- **New-agent avatars** use their public Facebook picture
  (`graph.facebook.com/<id>/picture`) so no files were downloaded. If you'd rather have
  local avatar files like the existing agents, say so.

## Likely duplicate / same unit (added anyway, flagged)
- **An Phu, Nguyễn Bỉnh Khiêm 50 sqm 14M** (apt-027, Thu Bùi) = the same JHouse listing
  Minh An also sent — kept **one** entry (noted "also offered by Minh An").
- **Hai Bà Trưng, D3, 14M** — added twice: apt-047 (Nguyễn Thị Ngọc) and apt-061
  (Kimee Dinh, with full details). Almost certainly the **same unit**. Consider deleting one.
- **Nguyễn Bỉnh Khiêm, Tân Định, apt 401, 14M** — Gemma Ngo and Kimee both sent this;
  it already exists as **apt-021** (Kimee), so it was **not** re-added.
- **Cô Giang, Cầu Kiệu, Phú Nhuận, 14M** (apt-059, Gemma) may be the same building as
  **apt-023** (Nam Lê, "46 Cô Giang"). Kept separate.
- **Nguyễn Lê Phúc "Le Van Sy 13mil"** (video) is probably the same as **apt-026**
  (453KA/62 Lê Văn Sỹ, 12M) — **not** added.

## Offers NOT added — missing address/price (need info)
- **Phương Giang** — a "room in D1, 13M" with no address or photos.
- **Nguyễn Thị Duyên** — a 2nd apartment (10 photos, "How about this?") with no
  address or price.
- **Minh An** — "456/17 Cao Thắng" new building, studios 9–12.5M (price *range*, and the
  specific unit was already rented).
- **Hoàng Lệ Thu** — a D1, 12M, 1BR+study with rooftop terrace, 4th-floor walk-up
  (8 photos) but **no address given**. You said you didn't like it.
- **Trương Nhật Thành** (broker, Nha Trang) — sent ~7 apartments as photo batches with
  prices 13.5M / 12M / 9.5M / 9.2M but only **one** address (added as apt-057,
  Nguyễn Văn Nguyễn, 10M). The other 4 have no address.
- **Gemma Ngo** — two serviced-apartment *buildings* with price ranges (not single units):
  AMR duplex on **Ngô Tất Tố, Bình Thạnh** 14.96–17M, and a building on
  **Nguyễn Cửu Vân, Bình Thạnh** 11.62–12.74M. Skipped (ranges, whole buildings).
- **Lâm Ngọc Hoàng Nguyên** — besides the canal-side 13M (added as apt-060, location
  approximate via a coffee-shop landmark), a "15M" option whose details were deleted.
- **Nam Lê** — two extra "a bit smaller / a bit over budget" options with no clear address.

## Chats with no offers (checked, nothing to add)
Tín Nguyễn (promised D1/D3 options, none sent yet), Anna Coulon, Nerys Ly (Dee House),
Ruby House Tân Định, Như Quỳnh Nguyễn, Khanh Huang Nguyen, Hoàng Nam, Trần Sơn — these
either only reacted to the fake batdongsan link or never replied (message request).
Kyra Zeah Sapanta is a personal/cafe contact, not an agent.

## Could not read (Messenger wouldn't load the thread)
- **Hanh Vo** (a landlord — "I'm landlord not agency"). The thread body never rendered
  (end-to-end encrypted, wouldn't restore on this device). Please open it yourself and
  paste anything useful, and I'll add it.

## Agents newly added to the map
Thu Bùi, Phương Giang, Anh Hoang, Nguyễn Thị Duyên, Thanh Nguyễn, My Duyen,
Julie Nguyen, Nguyễn Thị Ngọc, Minh An, Vương Hoàng Yến Nhi ("Sophie"),
Duong Nguyen (landlord, Twinpines), Thuy Alex, Trương Nhật Thành,
Gemma Ngo (has WhatsApp), Lâm Ngọc Hoàng Nguyên.
