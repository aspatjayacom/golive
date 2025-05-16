# Golive Streaming Panel

## Proses Instalasi

```sh
sudo apt update
sudo apt install python3 python3-pip ffmpeg python3-flask python3-psutil -y
```

## Clon Repositori

```sh
git clone https://github.com/aspatjayacom/golive/
cd golive
```

## Install gunicorn

```sh
apt install python3-gunicorn
```

## Menjalankan Dashboard Web

```sh
nohup gunicorn -w 1 -b 0.0.0.0:5000 Live:app &
```
Jika belum di Directory golive gunakan ini:

```sh
cd golive
nohup gunicorn -w 1 -b 0.0.0.0:5000 Live:app &
```

Akses dashboard di browser:

```sh
ip-vps:5000
```

STOP script streaming panel (dashboard web):

```sh
sudo ss -tulnp | grep :5000 | grep gunicorn | awk -F'pid=' '{for (i=2; i<=NF; i++) {split($i, a, ","); print a[1]}}' | xargs -r sudo kill -9 ; sudo pkill -9 ffmpeg
```

Cek nohup gunicorn:

```sh
tail -f nohup.out
```