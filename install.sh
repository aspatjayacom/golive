#!/bin/bash
set -e

echo "================================"
echo "   GoLive Installer  "
echo "================================"
echo

read -p "Mulai instalasi? (y/n): " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && echo "Instalasi dibatalkan." && exit 1

echo "🔄 Updating sistem..."
sudo apt update && sudo apt upgrade -y

echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "🎬 Installing FFmpeg dan Git..."
sudo apt install ffmpeg git -y

echo "📥 Clone repository..."
git clone https://github.com/aspatjayacom/golive
cd golive
chmod -R 755 public/uploads/

echo "⚙️ Installing dependencies..."
npm install
npm run generate-secret

echo "🕐 Setup timezone ke Asia/Jakarta..."
sudo timedatectl set-timezone Asia/Jakarta

echo "🔧 Setup firewall..."
sudo apt install ufw -y
sudo ufw allow 7575
sudo ufw allow 22
sudo ufw allow 1935
sudo ufw allow 443
sudo ufw --force enable

echo "🚀 Installing PM2..."
sudo npm install -g pm2

echo "▶️ Starting StreamFlow..."
pm2 start app.js --name golive
pm2 startup
pm2 save

echo
echo "================================"
echo "✅ INSTALASI SELESAI!"
echo "================================"

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "IP_SERVER")
echo
echo "🌐 URL Akses: http://$SERVER_IP:7575"
echo
echo "📋 Langkah selanjutnya:"
echo "1. Buka URL di browser"
echo "2. Buat username & password"
echo "3. Setelah bikin akun, logout lalu login ulang agar database singkron"
echo "================================"
