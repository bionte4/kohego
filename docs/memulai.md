# Memulai

## Persyaratan

- Node.js 20 atau lebih baru
- npm
- PostgreSQL hanya jika token sosmed atau batch produksi ingin disimpan di server

## Pasang

```bash
npm install
cp .env.example .env
npm run dev
```

Aplikasi ada di `http://localhost:3000`.

Perintah lain:

```bash
npm run lint
npm run build
npm run db:generate
npm run db:migrate
```

`db:generate` membuat klien Prisma. `db:migrate` menerapkan migrasi di `prisma/migrations` ke database pada `DATABASE_URL`.

## Variabel lingkungan

Salin dari `.env.example`. Jangan mengisi rahasia di file contoh, dan jangan mengunggah `.env`.

| Variabel | Pemakaian |
| --- | --- |
| `DATABASE_URL` | PostgreSQL untuk token sosmed, ternak server, dan batch produksi |
| `TOKEN_ENCRYPTION_KEY` | Kunci AES-256-GCM, 32 byte dalam base64. Buat dengan `openssl rand -base64 32` |
| `ROLE_SESSION_SECRET` | Menandatangani cookie peran. Jika kosong, aplikasi memakai `TOKEN_ENCRYPTION_KEY` |
| `KOHEGO_ALLOW_ROLE_SWITCH` | Isi `1` agar pengganti peran tetap hidup saat `NODE_ENV=production` |
| `META_APP_ID` | App Meta untuk Facebook dan Instagram |
| `META_APP_SECRET` | Rahasia app Meta |
| `TIKTOK_CLIENT_KEY` | Login Kit TikTok |
| `TIKTOK_CLIENT_SECRET` | Rahasia klien TikTok |

Tanpa `DATABASE_URL`, halaman Akun Sosmed menampilkan peringatan dan tombol Hubungkan tidak aktif. Dasbor, pesanan, kandang, dan penerbit tetap jalan dari penyimpanan browser.

## Database

1. Buat database PostgreSQL.
2. Isi `DATABASE_URL`.
3. Isi `TOKEN_ENCRYPTION_KEY` sebelum menyimpan token.
4. Jalankan `npm run db:migrate`.

Migrasi yang ada:

- `20261028150000_social_accounts` — akun OAuth
- `20261028163000_livestock` — kandang, ternak, dan kohe
- `20261028170000_production_batches` — log koleksi, varian, dan batch produksi

Mengganti `TOKEN_ENCRYPTION_KEY` membuat token yang sudah tersimpan tidak bisa dibaca.

## Produksi

Di production, cookie peran yang hilang dibaca sebagai penjualan lapangan. Pengganti peran di header mati kecuali `KOHEGO_ALLOW_ROLE_SWITCH=1`. Pasang login sungguhan sebelum membuka aplikasi ke internet; pengganti peran ini untuk uji lokal.
