# Peran dan API

Peran: `SUPER_ADMIN`, `FARM_MANAGER`, `FARM_KEEPER`, `FIELD_SALES`, `WAREHOUSE_ADMIN`.

Matriksnya ada di `src/lib/rbac.ts`. Tulisan di bawah ini yang berlaku untuk antarmuka dan route.

| Sumber daya | Super admin | Manajer kandang | Petugas kandang | Penjualan lapangan | Admin gudang |
| --- | --- | --- | --- | --- | --- |
| Ternak dan kohe | ubah | ubah | catat | baca | baca |
| Gudang asal | ubah | ubah | baca | baca | baca |
| Inventori dan opname | ubah | baca | — | baca | ubah |
| Kemasan | ubah | baca | — | baca | ubah |
| Pesanan | ubah | baca | — | ubah | baca |
| Mitra | ubah | baca | — | ubah | baca |
| Produksi | ubah | baca | — | baca | ubah |
| Pengguna | ubah | baca | — | baca | baca |
| Penggajian | ubah | — | — | — | — |

"Ubah" mencakup buat, ubah, dan hapus. "Catat" untuk petugas kandang berarti buat dan ubah ternak, pemeriksaan, serta kohe, tanpa menghapus ternak. "Baca" cukup untuk membuka tabel. Tanda "—" berarti menu dan API menolak.

Menu petugas kandang ada di **Hulu** (dasbor, kandang, kesehatan, jadwal pengobatan, silsilah, kepatuhan) dan **Hilir** (profil). Penggajian, di kelompok **Pengaturan**, hanya tampil untuk super admin. Arti kelompok menu ada di [modul.md](modul.md).

## Sesi

`GET /api/session` mengembalikan peran aktif. `POST /api/session` dengan `{ "role": "FIELD_SALES" }` menulis cookie httpOnly `kohego_role`. Cookie memuat peran, id pengguna, waktu kedaluwarsa, dan HMAC, lalu disegel AES-256-GCM.

Tanpa cookie yang sah, API menjawab 401 dan layar meminta masuk. Di development, pengganti peran di header boleh dipakai. Di production, `POST /api/session` ditolak kecuali `KOHEGO_ALLOW_ROLE_SWITCH=1`.

Tombol di layar mengikuti peran yang sama. Kalau API menolak, perubahan lokal tidak ditulis.

## Route

Route di bawah memeriksa peran sebelum menerima badan permintaan.

| Metode | Path | Tindakan |
| --- | --- | --- |
| GET, POST, PATCH, DELETE | `/api/orders` | Pesanan |
| POST | `/api/orders/fast` | Pesanan cepat. Penjualan lapangan tersimpan sebagai petugas nota |
| GET, POST, PATCH, DELETE | `/api/partners` | Mitra |
| GET, POST, PATCH, DELETE | `/api/inventory` | Stok masuk, kirim, koreksi, dan opname |
| GET, POST, PATCH, DELETE | `/api/sites` | Gudang asal |
| GET, POST, PATCH, DELETE | `/api/catalog` | Kemasan dan varian |
| GET, POST, PATCH, DELETE | `/api/livestock` | Ternak dan catatan kohe |
| POST | `/api/livestock/health` | Pemeriksaan kesehatan |
| POST | `/api/livestock/treatment` | Kasus pengobatan |
| POST | `/api/livestock/treatment/assist` | Saran daftar periksa kandang |
| POST | `/api/livestock/treatments` | Jadwal vaksin dan perawatan |
| POST | `/api/livestock/lineage` | Silsilah dan tahap hidup |
| POST | `/api/livestock/registry` | RFID 15 digit pada satu nomor telinga |
| GET | `/api/reports/compliance` | Acuan henti obat dan target kompos |
| GET, POST | `/api/livestock/withdrawal` | Aturan gejala dan periode henti obat |
| GET, POST, PATCH, DELETE | `/api/users` | Staf |
| POST | `/api/access` | Pemeriksaan umum `{ resource, action }` |
| POST | `/api/production` | Pratinjau atau penyelesaian batch |
| POST | `/api/production/compost` | Neraca C:N dan susut massa |
| GET, POST | `/api/reports/payroll` | Rekap gaji bulanan |
| POST | `/api/reports/consignment` | Piutang konsinyasi dan kunjungan |
| GET, PUT | `/api/ledgers` | Buku bersama antar perangkat |
| POST | `/api/publisher/dispatch` | Simulasi kirim ke platform yang dipilih |

Buku perangkat tetap sumber pencatatan harian. Route mengizinkan atau menolak tindakan, lalu layar menulis ke penyimpanan browser. Saat jaringan putus dan peran lokal memang boleh, pesanan lapangan tetap bisa disimpan. Jawaban 403 selalu menahan penulisan.

`POST /api/production` dengan `action: "complete"` menambah `product_variants.stock_on_hand` hanya jika `DATABASE_URL` terpasang. Tanpa database, jawaban membawa `persisted: false` dan stok kemasan tetap bertambah di perangkat. Penggajian, silsilah, kompos, dan konsinyasi memakai pola yang sama: angka dihitung di aplikasi, lalu baris PostgreSQL ditulis bila tabelnya ada.
