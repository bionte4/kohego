# Modul dan alur data

Buku kerja harian ada di browser. Server memeriksa peran dan, kalau database terpasang, menyimpan buku bersama, token, batch produksi, serta rekap gaji.

## Penyimpanan perangkat

| Kunci | Isi |
| --- | --- |
| `kohego.dashboard.v2` | Mitra, pesanan, gudang, stok, pergerakan, kunjungan, dan profil agen |
| `kohego.livestock.v1` | Kandang, ternak, kohe, kesehatan, pengobatan, silsilah, pakan, dan batch |
| `kohego.publisher.v1` | Draf, jadwal, dan riwayat kiriman |
| `kohego.users.v1` | Direktori staf |
| `kohego.payroll.v1` | Slip gaji yang sudah disimpan di perangkat |
| `kohego.role.v1` | Salinan peran untuk tampilan. Cookie yang ditandatangani yang dipercaya API |
| IndexedDB `kohego-media` | Berkas foto dan video penerbit |

Harga dan bobot pada baris pesanan disalin saat pesanan disimpan, jadi perubahan katalog tidak menulis ulang riwayat. Pesanan cepat oleh penjualan lapangan menyimpan `agentId` supaya komisi tidak tercampur.

## Dasbor dan penjualan

Dasbor membaca pesanan dan stok yang sama dengan halaman pesanan. Isi dasbor mengikuti peran: kandang untuk manajer dan petugas, gudang untuk admin gudang, penjualan untuk petugas lapangan, dan semuanya untuk super admin.

Konsinyasi mengurangi sisa plafon mitra sampai ditandai lunas. Pelunasan tidak menggerakkan stok lagi, karena sak sudah keluar saat pesanan disimpan. Pembatalan pesanan mengembalikan kemasan ke gudang asal dan menghapus pergerakan jual pesanan itu.

Halaman `/reports/financial` merangkum pendapatan, tonase, dan piutang. Halaman `/reports/consignment` menampilkan nota yang masih terbuka, jatuh tempo, dan usulan diskon tingkat. Tingkat 1 tanpa potongan, tingkat 2 (200 kg atau lebih pada bulan itu) 2 persen, tingkat 3 (800 kg atau lebih) 4 persen. Usulan itu tidak mengubah harga nota yang sudah tersimpan. Tombol kunjungan mencatat mitra dan, bila perangkat mengizinkan, koordinat petugas.

## Inventori

Stok dihitung dalam kemasan (`sak` atau `jerigen`), bukan kilogram. Sak di bawah 20 dan jerigen di bawah 8 ditandai menipis. Penerimaan menambah stok. Kirim antar gudang memindahkan lokasi tanpa mengubah total perusahaan. Hapus stok mencatat koreksi dan mengurangi on-hand.

Kohe segar tidak masuk stok kemasan sampai dikonversi di Manajemen Kandang.

## Kandang

Jenis ternak: Sapi, Kambing, Ayam, dan Bebek. Sapi dan kambing dicatat per ekor. Ayam dan bebek boleh dalam satu lot dengan nomor telinga yang sama.

Kesehatan: Sehat, Pantau, Sakit, Karantina, dan Terjual. Ternak terjual keluar dari isi kandang dan tidak lagi menghasilkan kohe. Ternak sakit atau karantina tidak dihitung pada proyeksi kohe harian.

Kohe tersedia bisa dikemas lewat hasil tetap, atau lewat tab **Produksi & konversi**. Rumus kemasan utuh:

```text
floor((bobot segar × rasio) / ukuran kemasan)
```

Rasio 0,80 berarti 80 persen bobot segar menjadi hasil jadi. Sisa yang tidak cukup satu kemasan ditampilkan sebelum batch ditutup. Batch selesai menarik kohe tertua lebih dulu, lalu menambah sak atau jerigen di gudang yang dipilih.

Bebek tidak punya SKU pupuk padat. Konversinya lewat POC.

### Kesehatan dan pengobatan

`/livestock/health` mencatat suhu, aktivitas, dan gejala. Skor adalah simulasi untuk petugas kandang, bukan diagnosis dokter hewan. `/livestock/treatments` menjadwalkan vaksin, obat cacing, vitamin, dan perawatan. Menyelesaikan jadwal menulis riwayat medis dan tidak mengubah status klinis ternak.

Daftar periksa pengobatan memakai gejala yang sudah dicatat. Takaran adalah rentang perencanaan pada label untuk spesies itu. Aplikasi tidak menghitung mg/kg antibiotik.

Periode henti obat memakai jumlah hari yang tercetak di label. Selama jendela itu masih berjalan, ternak tidak bisa ditandai terjual. Contoh pada buku baru: KMB-033 terkunci sampai tanggal henti obatnya lewat.

### Silsilah dan FCR

`/livestock/lineage` menyimpan tahap Pedet, Dewasa, atau Afkir. Tahap hanya bergerak maju. Induk dan pejantan harus ternak lain dengan jenis yang sama.

FCR = kilogram pakan di antara dua tanggal timbang, dibagi kenaikan bobot hidup. Dua catatan bobot diperlukan. Pada buku contoh, SPI-102 naik 28 kg dari 168 kg pakan, jadi FCR-nya 6.

### Kimia kompos

`/produksi/kimia` menghitung rasio karbon dibagi nitrogen dan susut massa:

```text
pupuk jadi = kohe segar × (1 − susut)
```

Target C:N adalah 25–30. Suhu 55–65°C yang bertahan beberapa hari menandai fase termofilik. Angka ini perencanaan proses. Sak yang masuk gudang tetap lewat batch produksi.

## Penggajian

`/reports/payroll` hanya untuk super admin. Periode memakai kalender Jakarta.

Komisi penjualan lapangan dihitung dari kilogram pupuk padat pada pesanan bulan itu:

| Tonase bulan | Tarif |
| --- | --- |
| Di bawah 500 kg | Rp 200 per kg |
| 500–1.499 kg | Rp 250 per kg |
| 1.500 kg atau lebih | Rp 300 per kg |

Bonus manajer kandang menjumlahkan tiga bagian: Rp 75.000 untuk tiap ternak yang pemeriksaan terakhirnya berskor minimal 70, Rp 50.000 untuk tiap ternak yang pulih dari skor di bawah 70, dan Rp 150.000 bila catatan kohe bulan itu selisihnya tidak lebih dari 15 persen terhadap proyeksi. Gaji pokok dan potongan bisa diubah sebelum slip ditandai lunas. Slip lunas tidak dihitung ulang.

## Penerbit

Lihat [penerbit.md](penerbit.md).

## Pengguna

Halaman `/settings/users` menyimpan nama, email, peran, dan status aktif. Formulir memakai React Hook Form dan Zod. Email ganda ditolak. Super admin aktif yang terakhir tidak bisa dinonaktifkan atau dihapus.

Akun Google yang baru masuk sebagai penjualan lapangan dan belum aktif. Super admin menetapkan peran lewat kartu **Menunggu penetapan peran**, lalu mengaktifkan akun. Peran **Petugas kandang** ada di daftar itu.
