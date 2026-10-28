# Peran dan API

Peran: `SUPER_ADMIN`, `FARM_MANAGER`, `FIELD_SALES`, `WAREHOUSE_ADMIN`.

Matriksnya ada di `src/lib/rbac.ts`. Tulisan di bawah ini yang berlaku untuk antarmuka dan route.

| Sumber daya | Super admin | Manajer kandang | Penjualan lapangan | Admin gudang |
| --- | --- | --- | --- | --- |
| Ternak dan kohe | ubah | ubah | baca | baca |
| Inventori | ubah | baca | baca | ubah |
| Pesanan | ubah | baca | ubah | baca |
| Mitra | ubah | baca | ubah | baca |
| Produksi | ubah | baca | baca | ubah |
| Pengguna | ubah | baca | baca | baca |

"Ubah" mencakup buat, ubah, dan hapus. "Baca" cukup untuk membuka tabel.

## Sesi

`GET /api/session` mengembalikan peran aktif. `POST /api/session` dengan `{ "role": "FIELD_SALES" }` menulis cookie httpOnly `kohego_role`. Nilai cookie adalah peran, waktu kedaluwarsa, dan HMAC. Cookie yang rusak dibaca sebagai penjualan lapangan, bukan super admin.

Di development, permintaan tanpa cookie diperlakukan sebagai super admin supaya data contoh tetap bisa dicoba. Di production, tanpa cookie berarti penjualan lapangan, dan `POST /api/session` ditolak kecuali `KOHEGO_ALLOW_ROLE_SWITCH=1`.

Tombol di layar mengikuti peran yang sama. Kalau API menolak, perubahan lokal tidak ditulis.

## Route

Semua route di bawah memeriksa peran sebelum menerima badan permintaan.

| Metode | Path | Tindakan |
| --- | --- | --- |
| GET, POST, PATCH, DELETE | `/api/orders` | Pesanan |
| GET, POST, PATCH, DELETE | `/api/partners` | Mitra |
| GET, POST, PATCH, DELETE | `/api/inventory` | Stok masuk, kirim, dan koreksi |
| GET, POST, PATCH, DELETE | `/api/livestock` | Ternak dan catatan kohe |
| GET, POST, PATCH, DELETE | `/api/users` | Staf |
| POST | `/api/access` | Pemeriksaan umum `{ resource, action }` |
| POST | `/api/production` | Pratinjau atau penyelesaian batch |
| POST | `/api/publisher/dispatch` | Simulasi kirim ke platform yang dipilih |

Buku perangkat tetap sumber pencatatan harian. Route mengizinkan atau menolak tindakan, lalu layar menulis ke penyimpanan browser. Saat jaringan putus dan peran lokal memang boleh, pesanan lapangan tetap bisa disimpan. Jawaban 403 selalu menahan penulisan.

`POST /api/production` dengan `action: "complete"` menambah `product_variants.stock_on_hand` hanya jika `DATABASE_URL` terpasang. Tanpa database, jawaban membawa `persisted: false` dan stok kemasan tetap bertambah di perangkat.
