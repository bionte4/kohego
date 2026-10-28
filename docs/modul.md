# Modul dan alur data

Buku kerja harian ada di browser. Server memeriksa peran dan, kalau database terpasang, menyimpan token serta batch produksi.

## Penyimpanan perangkat

| Kunci | Isi |
| --- | --- |
| `kohego.dashboard.v2` | Mitra, pesanan, gudang, stok, pergerakan, dan profil agen |
| `kohego.livestock.v1` | Kandang, ternak, kohe, dan batch konversi |
| `kohego.publisher.v1` | Draf, jadwal, dan riwayat kiriman |
| `kohego.users.v1` | Direktori staf |
| `kohego.role.v1` | Salinan peran untuk tampilan. Cookie yang ditandatangani yang dipercaya API |
| IndexedDB `kohego-media` | Berkas foto dan video penerbit |

Harga dan bobot pada baris pesanan disalin saat pesanan disimpan, jadi perubahan katalog tidak menulis ulang riwayat.

## Dasbor dan penjualan

Dasbor membaca pesanan dan stok yang sama dengan halaman pesanan. Konsinyasi mengurangi sisa plafon mitra sampai ditandai lunas. Pelunasan tidak menggerakkan stok lagi, karena sak sudah keluar saat pesanan disimpan.

Pembatalan pesanan mengembalikan kemasan ke gudang asal dan menghapus pergerakan jual pesanan itu.

## Inventori

Stok dihitung dalam kemasan (`sak` atau `jerigen`), bukan kilogram. Sak di bawah 20 dan jerigen di bawah 8 ditandai menipis. Penerimaan menambah stok. Kirim antar gudang memindahkan lokasi tanpa mengubah total perusahaan. Hapus stok mencatat koreksi dan mengurangi on-hand.

Kohe segar tidak masuk stok kemasan sampai dikonversi di Manajemen Kandang.

## Kandang

Jenis ternak: Sapi, Kambing, Ayam, dan Bebek. Sapi dan kambing dicatat per ekor. Ayam dan bebek boleh dalam satu lot dengan nomor telinga yang sama.

Kesehatan: Sehat, Pantau, Sakit, Karantina, dan Terjual. Ternak terjual keluar dari isi kandang dan tidak lagi menghasilkan kohe.

Kohe tersedia bisa dikemas lewat hasil tetap, atau lewat tab **Produksi & konversi**. Rumus kemasan utuh:

```text
floor((bobot segar × rasio) / ukuran kemasan)
```

Rasio 0,80 berarti 80 persen bobot segar menjadi hasil jadi. Sisa yang tidak cukup satu kemasan ditampilkan sebelum batch ditutup. Batch selesai menarik kohe tertua lebih dulu, lalu menambah sak atau jerigen di gudang yang dipilih.

Bebek tidak punya SKU pupuk padat. Konversinya lewat POC.

## Penerbit

Lihat [penerbit.md](penerbit.md).

## Pengguna

Halaman `/settings/users` menyimpan nama, email, peran, dan status aktif. Formulir memakai React Hook Form dan Zod. Email ganda ditolak. Super admin aktif yang terakhir tidak bisa dinonaktifkan atau dihapus.
