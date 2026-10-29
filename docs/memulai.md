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

Pertama kali di VPS, buat pengguna dan database, lalu isi `/etc/kohego.env`. Password di contoh ini harus diganti.

```bash
sudo -u postgres psql -c "CREATE USER kohego WITH PASSWORD 'ganti-password-ini';"
sudo -u postgres psql -c "CREATE DATABASE kohego OWNER kohego;"
```

```bash
DATABASE_URL=postgresql://kohego:ganti-password-ini@127.0.0.1:5432/kohego?schema=public
TOKEN_ENCRYPTION_KEY=hasil-openssl-rand-base64-32
```

Di VPS, aplikasi ada di `/var/www/kohego` dan lingkungan ada di `/etc/kohego.env`. Service `kohego` membaca file itu sebagai root sebelum menurunkan hak proses, jadi mode `600` milik root tetap benar. Prisma dari pengguna biasa perlu sumber yang sama.

Setelah `git pull`, hentikan service, terapkan migrasi, lalu bangun. `npm run build` menjalankan `prisma generate` sebelum `next build`. Nyalakan service hanya bila bangun selesai. Bila bangun gagal, biarkan service mati supaya nginx tidak memutar proses tanpa build.

```bash
cd /var/www/kohego
git pull
sudo systemctl stop kohego
if sudo bash -c 'set -a; source /etc/kohego.env; set +a; cd /var/www/kohego; npx prisma migrate deploy && npm run build'; then
  sudo systemctl start kohego
  sleep 3
  sudo systemctl status kohego --no-pager
  curl -sI http://127.0.0.1:3000/ | head -n 8
else
  echo "BUILD GAGAL, service tetap mati"
fi
```

`curl` yang menjawab 307 ke `/dashboard` atau 200 pada `/login` berarti proses Node sudah hidup.

Migrasi yang ada:

- `20261028150000_social_accounts` — akun OAuth
- `20261028163000_livestock` — kandang, ternak, dan kohe
- `20261028170000_production_batches` — log koleksi, varian, dan batch produksi
- `20261028183000_ledgers` — buku penjualan, kandang, penerbit, dan pengguna
- `20261028190000_login_credentials` — hash kata sandi staf
- `20261029100000_livestock_health_logs` — pemeriksaan kesehatan
- `20261029110000_livestock_treatment_cases` — kasus pengobatan
- `20261029120000_livestock_ops_alerts` — sinyal ternak sakit atau karantina
- `20261029130000_treatment_protocols` — protokol dan riwayat medis
- `20261029140000_livestock_treatments` — jadwal vaksin dan perawatan
- `20261029150000_payroll_records` — slip gaji bulanan
- `20261029160000_enterprise_modules` — silsilah, pakan, kompos, konsinyasi, kunjungan, dan henti obat

Mengganti `TOKEN_ENCRYPTION_KEY` membuat token yang sudah tersimpan tidak bisa dibaca.

## Produksi

Halaman aplikasi meminta masuk. Akun contoh memakai kata sandi `Kohego2026`: `rina@kohego.local` (super admin), `agus@kohego.local` (manajer kandang), `bambang@kohego.local` (admin gudang), dan `dewi@kohego.local` (penjualan lapangan). `sari@kohego.local` adalah penjualan lapangan yang nonaktif. Menu mengikuti peran akun. Pengganti peran di header hanya hidup saat pengembangan, atau di production bila `KOHEGO_ALLOW_ROLE_SWITCH=1`.

Akun Google baru tetap nonaktif sampai super admin menetapkan peran di `/settings/users`. Petugas kandang, manajer kandang, admin gudang, dan penjualan lapangan dipilih dari daftar yang sama.
