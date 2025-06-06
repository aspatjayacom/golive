![logo](https://raw.githubusercontent.com/aspatjayacom/golive/d364f8a75feb9df96f12c452f80c8c0671e83cf6/public/images/logo_mobile.svg)

# GoLive v2.0: Fresh From The Oven🔥

GoLive adalah aplikasi live streaming yang memungkinkan kamu untuk melakukan live streaming ke berbagai platform seperti YouTube, Facebook, Rumble, dan platform lainnya menggunakan protokol RTMP. Aplikasi ini bisa berjalan di VPS (Virtual Private Server) atau STB Armbian /PC/Laptop Ubuntu Server dan mendukung streaming ke banyak platform sekaligus.

## 🚀 Fitur Utama

- **Multi-Platform Streaming**: Mendukung streaming ke berbagai platform populer
- **Video Gallery**: Kelola koleksi video dengan mudah
- **Upload Video**: Upload video dari local atau import dari Google Drive
- **Scheduled Streaming**: Jadwalkan streaming dengan waktu tertentu
- **Advanced Settings**: Kontrol bitrate, resolution, FPS, dan orientasi
- **Real-time Monitoring**: Monitor status streaming secara real-time
- **Responsive UI**: Tampilan modern yang responsive di semua device

## 📋 Requirements

- **Node.js** v16 atau lebih baru
- **FFmpeg**
- **SQLite3** (sudah termasuk)
- **VPS/Server** dengan minimal 1Core & 1GB RAM
- **Port** 7575 (dapat diubah di [.env](.env))

## 🛠️ Instalasi di VPS

### 1. Persiapan VPS

Update sistem:

```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs
```

Verifikasi instalasi Node.js:

```bash
node --version
npm --version
```

Install FFmpeg:

```bash
sudo apt install ffmpeg -y
```

Verifikasi FFmpeg:
```bash
ffmpeg -version
```

Install Git:

```bash
sudo apt install git -y
```

### 2. Setup Projek GoLive

Clone repository ke VPS:

```bash
git clone https://github.com/aspatjayacom/golive
```

Masuk ke folder project:

```bash
cd golive
```

Install dependencies:

```bash
npm install
```

Generate session secret:

```bash
npm run generate-secret
```

**Konfigurasi tambahan (opsional):**

Port default aplikasi adalah **7575**. Jika perlu ubah port, edit file [.env](.env) (contoh: 8080, 3300, dll):

```bash
nano .env
```

### 3. Setup Firewall

Buka port sesuai dengan yang ada di .env (default: 7575):

```bash
sudo ufw allow 7575
```

Aktifkan firewall:

```bash
sudo ufw enable
```

Cek status firewall:

```bash
sudo ufw status
```

### 4. Install Process Manager (PM2)

Install PM2:

```bash
sudo npm install -g pm2
```

### 5. Cara Jalankan Aplikasi GoLive

Pastikan kamu masih berada di folder **golive**, jalankan perintah ini:

```bash
pm2 start app.js --name golive
```

Akses aplikasi di <b>IP_SERVER:PORT</b><br>
Contoh:

```bash
88.12.34.56:7575
```

Buat username dan password. Setelah masuk Dashboard, **Sign Out**. Lalu restart aplikasi dengan:

```bash
pm2 restart golive
```

## 📝 Informasi Tambahan

### Reset Password

Jika kamu lupa password atau ingin reset password, bisa ikutin cara berikut:

Masuk ke folder aplikasi:

```bash
cd golive
```

Jalankan perintah reset password:

```bash
node reset-password.js
```

### Setup Waktu Server (Timezone)

Untuk memastikan scheduled streaming berjalan dengan waktu yang tepat, atur timezone server sesuai zona waktu kamu:

#### 1. Cek Timezone Saat Ini

Lihat timezone aktif:

```bash
timedatectl status
```

#### 2. Lihat Daftar Timezone Yang Tersedia

Cari timezone Indonesia:

```bash
timedatectl list-timezones | grep Asia
```

Contoh set Timezone ke WIB (Jakarta):

```bash
sudo timedatectl set-timezone Asia/Jakarta
```

Verifikasi perubahan:

```bash
timedatectl status
```

Setelah mengubah timezone, restart aplikasi agar perubahan timezone berlaku:

```bash
pm2 restart golive
```

## 🪛 Troubleshooting

### Permission Error

Fix permission untuk folder uploads:

```bash
chmod -R 755 public/uploads/
```

### Port Already in Use

Cek process yang menggunakan port:

```bash
sudo lsof -i :7575
```

Kill process jika perlu:

```bash
sudo kill -9 <PID>
```

### Database Error

Reset database (HATI-HATI: akan menghapus semua data):

```bash
rm db/*.db
```

Restart aplikasi untuk create database baru.

## 🛠️ Instalasi di STB

### 1. Persiapan STB

Edit Config:

```bash
sudo nano /etc/apt/sources.list.d/armbian-config.sources
```

edit jadi:

```bash
Types: deb
#URIs: https://github.armbian.com/configng
Suites: stable
Components: main
#Signed-By: /usr/share/keyrings/armbian.gpg
```

Simpan Perubahan dan Keluar dari nano:

Tekan Ctrl + O (untuk "Write Out" atau menyimpan).
Tekan Enter untuk mengkonfirmasi nama file.
Tekan Ctrl + X (untuk keluar).

```bash
sudo rm /etc/apt/sources.list.d/armbian-config.sources
```

Update sistem:

```bash
sudo apt update && sudo apt upgrade -y
```
Edit Firewall:

```bash
sudo apt install ufw -y
sudo ufw allow 7575
sudo ufw allow 22
sudo ufw allow 1935
sudo ufw allow 443
sudo ufw allow 80
sudo ufw enable
```
Cek Status Port:

```bash
sudo ufw status
```

Install Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs
```

Verifikasi instalasi Node.js:

```bash
node --version
npm --version
```

Install FFmpeg:

```bash
sudo apt install ffmpeg -y
```

Verifikasi FFmpeg:
```bash
ffmpeg -version
```

Install Git:

```bash
sudo apt install git -y
```

### 2. Setup Projek GoLive

Clone repository ke STB:

```bash
git clone https://github.com/aspatjayacom/golive
```

Masuk ke folder project:

```bash
cd golive
```
Fix permission untuk folder uploads:

```bash
chmod -R 755 public/uploads/
```
Install dependencies:

```bash
npm install
```

Generate session secret:

```bash
npm run generate-secret
```

**Konfigurasi tambahan (opsional):**

Port default aplikasi adalah **7575**. Jika perlu ubah port, edit file [.env](.env) (contoh: 8080, 3300, dll):

```bash
nano .env
```

### 4. Install Process Manager (PM2)

Install PM2:

```bash
sudo npm install -g pm2
```

### 5. Cara Jalankan Aplikasi GoLive

Pastikan kamu masih berada di folder **golive**, jalankan perintah ini:

```bash
pm2 start app.js --name golive
pm2 startup
pm2 save
```

Akses aplikasi di <b>IP_SERVER:PORT</b><br>
Contoh:

```bash
88.12.34.56:7575
```

Buat username dan password. Setelah masuk Dashboard, **Sign Out**. Lalu restart aplikasi dengan:

```bash
pm2 restart golive
```

cek status memori/hdd:

```bash
df -h
```
## Lisensi:

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/aspatjayacom/golive/blob/main/LICENSE)

© 2025 - [Mirza Dev](https://geratis.my.id)
