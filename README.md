# KoheGo

Dasbor penjualan dan distribusi pupuk organik untuk tim lapangan. KoheGo mencatat pesanan, stok kemasan, mitra, kandang, konversi kohe menjadi pupuk, dan antrian unggahan ke TikTok, Instagram, Facebook, serta Threads.

Aplikasi tetap bisa mencatat di browser saat sinyal lemah. Saat `DATABASE_URL` diisi, pesanan, stok, mitra, kandang, antrian penerbit, dan daftar pengguna ikut tersimpan di PostgreSQL supaya perangkat lain membaca data yang sama. Foto dan video tetap di browser.

## Mulai

```bash
npm install
cp .env.example .env
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Data contoh sudah terisi: gudang, mitra, ternak, dan beberapa kiriman sosmed.

Database dan sambungan OAuth bersifat opsional untuk pemakaian harian. Langkahnya ada di [docs/memulai.md](docs/memulai.md).

## Modul

| Halaman | Path | Isi |
| --- | --- | --- |
| Dasbor | `/` | Pendapatan, tonase, dan komposisi produk |
| Pesanan cepat | `/penjualan` | Order lapangan, pembayaran, dan pelunasan |
| Inventori | `/inventori` | Stok sak dan jerigen, penerimaan, dan kirim antar gudang |
| Mitra | `/mitra` | Toko tani, perkebunan, dan urban farmer |
| Profil | `/profil` | Identitas agen |
| Manajemen Kandang | `/kandang` | Ternak, kohe segar, dan produksi |
| Dasbor Publisher | `/publisher` | Naskah, media, jadwal, dan status kirim |
| Akun Sosmed | `/pemasaran/akun` | Sambungan OAuth Instagram, Facebook, dan TikTok |
| Pengguna | `/settings/users` | Staf, peran, dan status akun |

Di layar kecil, bilah bawah tetap **Pesanan**, **Stok**, **Mitra**, dan **Profil**. Modul lain muncul sebagai chip di atas konten.

## Peran

Pengganti peran di header adalah sesi lokal untuk mencoba akses. Cookie `kohego_role` ditandatangani server.

| Peran | Yang boleh diubah |
| --- | --- |
| Super admin | Semua, termasuk daftar pengguna |
| Manajer kandang | Ternak, kohe, dan gudang asal |
| Penjualan lapangan | Pesanan dan mitra |
| Admin gudang | Inventori, kemasan, opname, dan produksi |

Peran lain tetap bisa membaca tabel. Rinciannya ada di [docs/peran.md](docs/peran.md).

## Dokumentasi

- [Memulai dan variabel lingkungan](docs/memulai.md)
- [Modul dan alur data](docs/modul.md)
- [Peran dan API](docs/peran.md)
- [Penerbit dan akun sosmed](docs/penerbit.md)

## Tumpukan

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 6, Zod, dan React Hook Form.
