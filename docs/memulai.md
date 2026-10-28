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
| `DATABASE_URL` | PostgreSQL untuk pesanan, stok, mitra, kandang, penerbit, pengguna, dan token sosmed |
| `TOKEN_ENCRYPTION_KEY` | Kunci AES-256-GCM, 32 byte dalam base64. Buat dengan `openssl rand -base64 32` |
| `ROLE_SESSION_SECRET` | Menandatangani cookie peran. Jika kosong, aplikasi memakai `TOKEN_ENCRYPTION_KEY` |
| `NEXTAUTH_SECRET` | Mengenkripsi sesi Google. Buat dengan `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Alamat publik aplikasi, misalnya `https://kohego.my.id` |
| `GOOGLE_CLIENT_ID` | OAuth client Google untuk tombol Masuk dengan Google |
| `GOOGLE_CLIENT_SECRET` | Rahasia client Google. Kosongkan ketiganya jika tombol Google belum dipakai |
| `KOHEGO_ALLOW_ROLE_SWITCH` | Isi `1` agar pengganti peran tetap hidup saat `NODE_ENV=production` |
| `META_APP_ID` | App Meta untuk Facebook dan Instagram |
| `META_APP_SECRET` | Rahasia app Meta |
| `TIKTOK_CLIENT_KEY` | Login Kit TikTok |
| `TIKTOK_CLIENT_SECRET` | Rahasia klien TikTok |

Tanpa `DATABASE_URL`, halaman Akun Sosmed menampilkan peringatan dan tombol Hubungkan tidak aktif. Dasbor, pesanan, kandang, dan penerbit tetap jalan dari penyimpanan browser.

Dengan `DATABASE_URL`, browser mengirim buku penjualan, kandang, penerbit, dan pengguna ke tabel `ledgers`. Perangkat lain yang membuka aplikasi yang sama membaca buku itu. Foto dan video unggahan tetap di browser.

## Database

1. Buat database PostgreSQL.
2. Isi `DATABASE_URL` dan `TOKEN_ENCRYPTION_KEY`.
3. Jalankan `npm run db:migrate`.
4. Bangun ulang aplikasi dan jalankan ulang prosesnya.

Di VPS:

```bash
sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER kohego WITH PASSWORD 'ganti-password-ini';"
sudo -u postgres psql -c "CREATE DATABASE kohego OWNER kohego;"
```

Tambahkan ke `/etc/kohego.env`:

```bash
DATABASE_URL=postgresql://kohego:ganti-password-ini@127.0.0.1:5432/kohego?schema=public
TOKEN_ENCRYPTION_KEY=hasil-openssl-rand-base64-32
```

Lalu:

```bash
cd /var/www/kohego
sudo -u www-data env $(grep -v '^#' /etc/kohego.env | xargs) npx prisma migrate deploy
sudo systemctl restart kohego
```

Migrasi yang ada:

- `20261028150000_social_accounts` — akun OAuth
- `20261028163000_livestock` — kandang, ternak, dan kohe
- `20261028170000_production_batches` — log koleksi, varian, dan batch produksi
- `20261028183000_ledgers` — buku penjualan, kandang, penerbit, dan pengguna

Mengganti `TOKEN_ENCRYPTION_KEY` membuat token yang sudah tersimpan tidak bisa dibaca.

## Produksi

Halaman aplikasi meminta masuk. Akun contoh memakai kata sandi `Kohego2026`: `rina@kohego.local` (super admin), `agus@kohego.local` (manajer kandang), `bambang@kohego.local` (admin gudang), dan `dewi@kohego.local` (penjualan lapangan). Menu mengikuti peran akun. Pengganti peran di header hanya hidup saat pengembangan, atau di production bila `KOHEGO_ALLOW_ROLE_SWITCH=1`.
