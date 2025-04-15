# GoLive Aplikasi Multi Live Streaming

GoLive adalah aplikasi live streaming yang memungkinkan kamu untuk melakukan live streaming ke berbagai platform seperti YouTube, Facebook, dan lainnya menggunakan protokol RTMP. Aplikasi ini berjalan di VPS (Virtual Private Server) dan mendukung streaming ke banyak platform sekaligus dengan fitur multi-window. GoLive juga dilengkapi dengan fitur login, gallery dan history streaming untuk melacak history streaming.

## Fitur Utama:

* **Multi-Window Streaming:** Bisa melakukan streaming ke beberapa platform sekaligus dalam satu aplikasi.
* **Dukungan Banyak Platform:** Bisa streaming ke YouTube, Facebook, dan platform lain yang mendukung RTMP.
* **Login Page:** Ada fitur login supaya hanya pemilik akun yang bisa akses aplikasi.
* **Riwayat Streaming:** Semua aktivitas streaming tersimpan, jadi bisa dilihat kembali kapan saja.

## Cara Instalasi:

**Sebelum mulai:** Pastikan server / VPS kamu sudah terinstall Node.js, npm, dan FFmpeg sebelum meng-clone repositori ini.

1. **Install Node.js dan npm melalui NodeSource PPA:**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo apt-get install -y npm
   ```
   Cek apakah instalasi berhasil:
   ```bash
   node -v
   npm -v
   ```

2. **Install FFmpeg:**

   ```bash
   sudo apt-get update
   sudo apt-get install -y ffmpeg
   ```
   Cek apakah instalasi berhasil:
   ```bash
   ffmpeg -version
   ```
   
3. **Install PM2 + Sharp:**

   ```bash
   npm install -g pm2
   npm install --os=linux --cpu=x64 sharp
   ```

4. **Clone Repositori:**
   ```bash
   git clone https://github.com/aspatjayacom/golive/
   cd golive
   ```

5. **Install Dependensi:**
   Jalankan `npm install` untuk menginstal semua modul Node.js yang dibutuhkan seperti Express.js, SQLite3, bcryptjs, dan lainnya.

   ```bash
   npm install
   npm install fluent-ffmpeg
   ```

6. **Jalankan Aplikasi:**

   Kembali ke directory root (jika masih di directory golive)
   ```bash
   cd ..
   ```

   🚀 Perintah menjalankan aplikasi ✨
   ```bash
   pm2 start golive
   pm2 logs golive -i 0 --lines 1
   ```

   📈 Melihat status aplikasi berjalan
   ```bash
   pm2 status golive
   ```

   ⛔ Menghentikan aplikasi
   ```bash
   pm2 stop golive
   ```

7. **Reset Password:**
   
   Jalankan perintah ini di terminal
   ```bash
   npm start reset-golive
   ```

9. **Konfigurasi:**
    * Pastikan kamu sudah mengatur URL RTMP yang sesuai untuk setiap platform yang ingin digunakan. Konfigurasi ini bisa dilakukan langsung melalui tampilan aplikasi.
    * Silahkan dapatkan Stream Key dari platform streaming yang kamu gunakan.

## Informasi Tambahan:

* Aplikasi ini menggunakan Express.js sebagai backend, SQLite sebagai database, dan FFmpeg untuk encoding serta streaming.
* Antarmuka pengguna dibuat dengan HTML, CSS, dan JavaScript, serta menggunakan Tailwind CSS untuk styling.
* Aplikasi ini dirancang untuk berjalan di server dengan Node.js, bukan di browser lokal.
