# KoheGo

Dasbor penjualan dan distribusi pupuk organik untuk tim lapangan. KoheGo mencatat pesanan, stok kemasan, mitra, kandang, konversi kohe menjadi pupuk, dan antrian unggahan ke TikTok, Instagram, Facebook, serta Threads.

Aplikasi berjalan di perangkat lebih dulu. Pesanan, stok, ternak, dan draf unggahan tersimpan di browser, jadi agen tetap bisa mencatat saat sinyal lemah. PostgreSQL dipakai untuk token sosmed, batch produksi, dan ledger server saat `DATABASE_URL` diisi.

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
| Manajer kandang | Ternak dan kohe |
| Penjualan lapangan | Pesanan dan mitra |
| Admin gudang | Inventori dan produksi |

Peran lain tetap bisa membaca tabel. Rinciannya ada di [docs/peran.md](docs/peran.md).

## Dokumentasi

- [Memulai dan variabel lingkungan](docs/memulai.md)
- [Modul dan alur data](docs/modul.md)
- [Peran dan API](docs/peran.md)
- [Penerbit dan akun sosmed](docs/penerbit.md)

## Tumpukan

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma 6, Zod, dan React Hook Form.
