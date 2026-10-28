# Penerbit dan akun sosmed

Dasbor ada di `/publisher`. Halaman `/pemasaran` membuka layar yang sama. Akun OAuth ada di `/pemasaran/akun`.

## Naskah

Pilih pupuk atau ternak. **Buat naskah otomatis** menyusun kalimat dari nama, bobot atau volume, harga, dan stok kemasan di semua gudang. Untuk ternak, naskah memakai ras, nomor telinga, bobot hidup, dan kandang. Naskah bisa diubah sebelum disimpan.

Platform: TikTok, Instagram, Facebook, dan Threads. Tiap platform punya batas karakter. Threads 500, TikTok dan Instagram 2200, Facebook 5000.

## Media

Foto dan video masuk dari perangkat, arsip browser, atau tautan awan. Pratinjau menampilkan ukuran berkas dan resolusi. Berkas tinggal di IndexedDB, bukan di dalam objek kiriman.

**Tanda telinga** membakar label `#` diikuti nomor telinga ke foto, misalnya `#SPI-102`. Video hanya menampilkan label di pratinjau, tanpa dikode ulang. Kontak memakai nama dan telepon dari profil agen.

## Kirim dan jadwal

**Jadwalkan** menyimpan kiriman dengan status **Menunggu** pada tiap platform yang dipilih.

**Terbitkan sekarang** memanggil `POST /api/publisher/dispatch`. Route itu simulasi: tidak ada unggahan ke TikTok atau Meta. Hasil tiap kanal:

- **Menunggu** saat kiriman baru masuk antrian atau masih terjadwal
- **Terbit** jika kanal menerima naskah
- **Gagal** jika kanal butuh foto atau video tetapi kiriman kosong, naskah melebihi batas, atau akun mock belum terhubung

TikTok dan Instagram membutuhkan foto atau video. Facebook dan Threads dapat terbit sebagai teks.

## Akun sungguhan

Instagram, Facebook, dan TikTok memakai OAuth. Threads tetap di antrian penerbit dan tidak menyimpan token di modul akun.

Sebelum menekan Hubungkan:

1. PostgreSQL hidup dan `npm run db:migrate` sudah dijalankan.
2. `TOKEN_ENCRYPTION_KEY` terisi. Token disimpan sebagai ciphertext AES-256-GCM. Respons API tidak pernah mengembalikan token.
3. Kredensial Meta dan TikTok terisi.

Redirect yang didaftarkan di konsol masing-masing:

```text
http://localhost:3000/api/social-accounts/oauth/instagram/callback
http://localhost:3000/api/social-accounts/oauth/facebook/callback
http://localhost:3000/api/social-accounts/oauth/tiktok/callback
```

Ganti host saat aplikasi dipasang di domain lain. Access token yang mendekati kedaluwarsa diperbarui di server. Putuskan akun menghapus ciphertext dari database.
