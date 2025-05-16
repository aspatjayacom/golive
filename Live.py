from flask import Flask, render_template_string, request, redirect, url_for, send_from_directory
import subprocess
import time
import threading
import shutil
from pathlib import Path
import uuid
import psutil
import json
import datetime
import sqlite3

DB_PATH = "live_data.db"

def get_base_path():
    return Path("Video")

def monitor_stderr(process, log_file):
    with open(log_file, "w", encoding="utf-8") as log:
        for line in process.stderr:
            if any(keyword in line.lower() for keyword in ["error", "failed", "disconnect", "broken"]):
                log.write(f"[!!] {line}")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS live_streams (
            live_id TEXT PRIMARY KEY,
            title TEXT,
            video_file TEXT,
            stream_key TEXT,
            rtmp_url TEXT,
            duration INTEGER,
            status TEXT,
            remaining INTEGER,
            start_time REAL,
            end_time REAL
        )
    """)
    conn.commit()
    conn.close()

init_db()

def save_live_to_db(live_id, info):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO live_streams
        (live_id, title, video_file, stream_key, rtmp_url, duration, status, remaining, start_time, end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        live_id,
        info.get("title"),
        info.get("video_file"),
        info.get("stream_key"),
        info.get("rtmp_url"),
        int(info.get("duration", 0)),
        info.get("status"),
        int(info.get("remaining", 0)),
        info.get("start_time", 0),
        info.get("end_time", 0)
    ))
    conn.commit()
    conn.close()

def update_status_in_db(live_id, status, remaining):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE live_streams SET status=?, remaining=? WHERE live_id=?", (status, remaining, live_id))
    conn.commit()
    conn.close()

def delete_live_from_db(live_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM live_streams WHERE live_id=?", (live_id,))
    conn.commit()
    conn.close()

def get_all_lives_from_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT * FROM live_streams")
    rows = c.fetchall()
    conn.close()
    lives = {}
    for row in rows:
        lives[row[0]] = {
            "title": row[1],
            "video_file": row[2],
            "stream_key": row[3],
            "rtmp_url": row[4],
            "duration": row[5],
            "status": row[6],
            "remaining": row[7],
            "start_time": row[8],
            "end_time": row[9],
            "thread": None,
            "process": None
        }
    return lives

def start_stream_flask(title, video_file, stream_key, stream_url, stream_duration, live_id):
    base_path = get_base_path()
    log_dir = Path("Log")
    log_dir.mkdir(exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"{Path(video_file).stem}_{timestamp}_log.txt"
    video_path = base_path / video_file
    if not video_path.exists():
        LIVE_DATA[live_id]["status"] = f"File video tidak ditemukan: {video_path}"
        return
    if shutil.which("ffmpeg") is None:
        LIVE_DATA[live_id]["status"] = "ffmpeg tidak ditemukan di PATH!"
        return
    has_audio = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
        "stream=codec_type", "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path)
    ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    command = [
        "ffmpeg",
        "-nostdin",
        "-re",
        "-y",
        "-stream_loop", "-1",
        "-i", str(video_path)
    ]
    if not has_audio.stdout.strip():
        command += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
    command += ["-c:v", "copy"]
    command += ["-c:a", "copy"]
    command += ["-threads", "0"]
    command += ["-f", "flv", stream_url + "/" + stream_key]
    nice_level = 5
    try:
        process = subprocess.Popen([
            "nice", f"-n{nice_level}", *command
        ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        LIVE_DATA[live_id]["process"] = process

        def monitor_ffmpeg():
            with open(log_file, "a", encoding="utf-8") as log:
                for line in process.stderr:
                    if any(word in line.lower() for word in ["error", "failed", "disconnect", "broken"]):
                        log.write(line)
            process.wait()
            LIVE_DATA[live_id]["status"] = "Stopped"
            LIVE_DATA[live_id]["remaining"] = 0

        monitor_thread = threading.Thread(target=monitor_ffmpeg, daemon=True)
        monitor_thread.start()

        duration_left = stream_duration
        start_time = time.monotonic()
        real_start_time = time.time()
        end_time = real_start_time + stream_duration
        LIVE_DATA[live_id]["start_time"] = real_start_time
        LIVE_DATA[live_id]["end_time"] = end_time
        save_live_to_db(live_id, LIVE_DATA[live_id])
        while True:
            if process.poll() is not None:
                break
            elapsed = int(time.monotonic() - start_time)
            remaining = max(0, stream_duration - elapsed)
            if remaining <= 0:
                break
            LIVE_DATA[live_id]["status"] = f"LIVE: {video_file}"
            LIVE_DATA[live_id]["remaining"] = remaining
            update_status_in_db(live_id, LIVE_DATA[live_id]["status"], remaining)
            time.sleep(1)
    
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        LIVE_DATA[live_id]["status"] = "Stopped"
        LIVE_DATA[live_id]["remaining"] = 0
        update_status_in_db(live_id, "Stopped", 0)
    except Exception as e:
        LIVE_DATA[live_id]["status"] = f"Error: {e}"
        LIVE_DATA[live_id]["remaining"] = 0
        update_status_in_db(live_id, LIVE_DATA[live_id]["status"], 0)

app = Flask(__name__)
UPLOAD_FOLDER = Path("Video")
UPLOAD_FOLDER.mkdir(exist_ok=True)
ASSETS_FOLDER = Path("Assets")
ASSETS_FOLDER.mkdir(exist_ok=True)
LIVE_DATA = {}

DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Golive Panel Streaming</title>
    <link rel="icon" type="image/x-icon" href="{{ url_for('assets', filename='favicon.ico') }}">
    <link rel="stylesheet" href="{{ url_for('assets', filename='style.css') }}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>
    function showSection(id) {
        document.getElementById('upload-section').style.display = 'none';
        document.getElementById('addstream-section').style.display = 'none';
        document.getElementById('cpu-section').style.display = 'none';
        if (id) document.getElementById(id).style.display = 'block';
    }
    window.onload = function() {
        showSection(null);
    }
    // Upload progress
    function uploadWithProgress(form) {
        var formData = new FormData(form);
        var xhr = new XMLHttpRequest();
        var progressBar = document.getElementById('upload-progress');
        var percentText = document.getElementById('upload-percent');
        progressBar.style.display = 'block';
        percentText.style.display = 'inline';
        xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
                var percent = Math.round((e.loaded / e.total) * 100);
                progressBar.value = percent;
                percentText.textContent = percent + '%';
            }
        };
        xhr.onload = function() {
            progressBar.style.display = 'none';
            percentText.style.display = 'none';
            if (xhr.status == 200) {
                window.location.reload();
            } else {
                alert('Upload gagal');
            }
        };
        xhr.open("POST", form.action, true);
        xhr.send(formData);
        return false;
    }
    // CPU Usage fetch
    function fetchCpuUsage() {
        fetch("{{ url_for('cpu_usage') }}")
        .then(response => response.json())
        .then(data => {
            document.getElementById('cpu-usage').textContent = data.cpu + " %";
            document.getElementById('ram-usage').textContent = data.ram + " %";
            document.getElementById('ram-used').textContent = data.ram_used + " MB / " + data.ram_total + " MB";
            document.getElementById('net-sent').textContent = data.net_sent + " MB";
            document.getElementById('net-recv').textContent = data.net_recv + " MB";
        });
    }
    function showCpuSection() {
        showSection('cpu-section');
        fetchCpuUsage();
    }
    function formatDuration(seconds) {
        if (isNaN(seconds) || seconds < 0) return "-";
        var h = Math.floor(seconds / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        var s = seconds % 60;
        return h.toString().padStart(2,'0') + ":" + m.toString().padStart(2,'0') + ":" + s.toString().padStart(2,'0');
    }
    function updateCountdowns() {
        var elements = document.querySelectorAll('[data-remaining]');
        elements.forEach(function(el) {
            var sec = parseInt(el.getAttribute('data-remaining'));
            if (!isNaN(sec) && sec > 0) {
                el.textContent = formatDuration(sec);
                el.setAttribute('data-remaining', sec - 1);
            } else if (sec === 0) {
                el.textContent = "00:00:00";
            }
        });
    }
    setInterval(updateCountdowns, 1000);
    </script>
</head>
<body>
    <div class="container">
        <header>
            <img src="{{ url_for('assets', filename='logo.png') }}" alt="Logo" class="logo">
            <h1>Golive Dashboard</h1>
            <nav style="margin-left:auto;">
                <button class="btn btn-primary" type="button" onclick="showSection('upload-section')">Upload</button>
                <button class="btn btn-primary" type="button" onclick="showSection('addstream-section')">Add Live</button>
                <button class="btn btn-primary" type="button" onclick="showCpuSection()">CPU Usage</button>
            </nav>
        </header>
        <div id="upload-section" class="section card" style="display:none;">
            <h2>Upload Video</h2>
            <form action="{{ url_for('upload') }}" method="post" enctype="multipart/form-data" onsubmit="return uploadWithProgress(this);">
                <input type="file" name="video" required>
                <button class="btn" type="submit">Upload</button>
                <progress id="upload-progress" value="0" max="100" style="display:none;width:200px;vertical-align:middle;"></progress>
                <span id="upload-percent" style="display:none;margin-left:8px;">0%</span>
            </form>
            <ul class="videolist">
            {% for v in videos %}
                <li>
                    {{ v }}
                    <form action="{{ url_for('delete_video') }}" method="post" style="display:inline;" onsubmit="return confirm('Hapus video {{v}}?');">
                        <input type="hidden" name="video_file" value="{{ v }}">
                        <button class="btn btn-delete" type="submit" style="padding:2px 10px;font-size:0.95em;">Delete</button>
                    </form>
                </li>
            {% endfor %}
            </ul>
        </div>
        <div id="addstream-section" class="section card" style="display:none;">
            <h2>Start New Live</h2>
            <form action="{{ url_for('start_live') }}" method="post" class="form-live">
                <label>Title:<input type="text" name="title" required></label>
                <label>Video:
                    <select name="video_file" required>
                        {% for v in videos %}
                            <option value="{{ v }}">{{ v }}</option>
                        {% endfor %}
                    </select>
                </label>
                <label>Stream Key:<input type="text" name="stream_key" required></label>
                <label>RTMP URL:<input type="text" name="rtmp_url" value="rtmp://a.rtmp.youtube.com/live2" required></label>
                <label>Durasi (jam):<input type="number" name="duration" value="1" min="1" required></label>
                <button class="btn btn-primary" type="submit">Start Live</button>
            </form>
        </div>
        <div id="cpu-section" class="section card" style="display:none;">
            <h2>Monitoring Resource</h2>
            <table>
                <tr><th>CPU Usage</th><td id="cpu-usage">-</td></tr>
                <tr><th>RAM Usage</th><td id="ram-usage">-</td></tr>
                <tr><th>RAM Used</th><td id="ram-used">-</td></tr>
                <tr><th>Network Sent</th><td id="net-sent">-</td></tr>
                <tr><th>Network Received</th><td id="net-recv">-</td></tr>
            </table>
            <button class="btn" onclick="fetchCpuUsage()">Refresh</button>
        </div>
        <div class="section card">
            <h2>Data Live Streaming</h2>
            <div class="table-responsive">
            <table>
                <tr>
                    <th>Title</th><th>Video</th><th>Stream Key</th><th>RTMP</th><th>Durasi</th><th>Status</th><th>Aksi</th>
                </tr>
                {% for live_id, live in lives.items() %}
                <tr>
                    <td>{{ live['title'] }}</td>
                    <td>{{ live['video_file'] }}</td>
                    <td>{{ live['stream_key'] }}</td>
                    <td>{{ live['rtmp_url'] }}</td>
                    <td>
                        {% if live['status'] == "Running" %}
                            <span data-remaining="{{ live.get('remaining', 0) }}">
                                {{ "%02d:%02d:%02d" % (
                                    (live.get('remaining', 0) // 3600),
                                    (live.get('remaining', 0) % 3600) // 60,
                                    (live.get('remaining', 0) % 60)
                                ) }}
                            </span>
                        {% elif live['status'] == "Stopped" %}
                            00:00:00
                        {% else %}
                            -
                        {% endif %}
                    </td>
                    <td>
                        {% if live['status'] == "Running" %}
                            <span class="badge badge-live">Running</span>
                        {% elif live['status'] == "Stopped" %}
                            <span class="badge badge-stopped">Stopped</span>
                        {% else %}
                            <span class="badge badge-other">{{ live['status'] }}</span>
                        {% endif %}
                    </td>
                    <td>
                        {% if live['status'] == "Running" %}
                        <form action="{{ url_for('stop_live', live_id=live_id) }}" method="post" style="display:inline;">
                            <button class="btn btn-danger" type="submit">Stop</button>
                        </form>
                        {% elif live['status'] == "Stopped" %}
                        <form action="{{ url_for('delete_live', live_id=live_id) }}" method="post" style="display:inline;">
                            <button class="btn btn-delete" type="submit">Delete</button>
                        </form>
                        {% endif %}
                    </td>
                </tr>
                {% endfor %}
            </table>
            </div>
        </div>
        <footer>
            <small>&copy; {{ year }} Live Streaming Panel &mdash; by Ananda Chakim</small>
        </footer>
    </div>
</body>
</html>
"""

@app.route('/assets/<path:filename>')
def assets(filename):
    return send_from_directory(ASSETS_FOLDER, filename)

@app.route("/", methods=["GET"])
def dashboard():
    videos = [f.name for f in UPLOAD_FOLDER.glob("*") if f.is_file()]
    lives = get_all_lives_from_db()
    now = datetime.datetime.now()
 
    for lid, info in LIVE_DATA.items():
        if info.get("process") and info["process"].poll() is not None:
            info["status"] = "Stopped"
            info["remaining"] = 0
            update_status_in_db(lid, "Stopped", 0)
        elif info.get("thread") and info["thread"].is_alive():
            if info.get("status") != "Stopped":
                info["status"] = "Running"
            if info.get("end_time"):
                remaining = int(info["end_time"] - now.timestamp())
                info["remaining"] = max(0, remaining)
                update_status_in_db(lid, info["status"], info["remaining"])
  
            lives[lid] = info
 
    for lid, info in LIVE_DATA.items():
        if lid not in lives and info.get("status") == "Running":
            lives[lid] = info
    return render_template_string(DASHBOARD_HTML, videos=videos, lives=lives, year=now.year)

@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("video")
    if file and file.filename:
        save_path = UPLOAD_FOLDER / file.filename
        file.save(str(save_path))
    return redirect(url_for('dashboard'))

@app.route("/start_live", methods=["POST"])
def start_live():
    title = request.form["title"]
    video_file = request.form["video_file"]
    stream_key = request.form["stream_key"]
    rtmp_url = request.form["rtmp_url"]
    duration = int(float(request.form["duration"]) * 3600)
    live_id = str(uuid.uuid4())
    def run_live():
        start_stream_flask(title, video_file, stream_key, rtmp_url, duration, live_id)
    t = threading.Thread(target=run_live, daemon=True)
    LIVE_DATA[live_id] = {
        "title": title,
        "video_file": video_file,
        "stream_key": stream_key,
        "rtmp_url": rtmp_url,
        "duration": request.form["duration"],
        "thread": t,
        "process": None,
        "status": "Running",
        "remaining": duration,
        "start_time": time.time(),
        "end_time": time.time() + duration
    }
    save_live_to_db(live_id, LIVE_DATA[live_id])
    t.start()
    return redirect(url_for('dashboard'))

@app.route("/stop_live/<live_id>", methods=["POST"])
def stop_live(live_id):
    live = LIVE_DATA.get(live_id)
    if live and live["process"]:
        live["process"].terminate()
        live["status"] = "Stopped"
        live["remaining"] = 0
        update_status_in_db(live_id, "Stopped", 0)
    return redirect(url_for('dashboard'))

@app.route("/delete_live/<live_id>", methods=["POST"])
def delete_live(live_id):
    if live_id in LIVE_DATA:
        del LIVE_DATA[live_id]
    delete_live_from_db(live_id)
    return redirect(url_for('dashboard'))

@app.route("/delete_video", methods=["POST"])
def delete_video():
    video_file = request.form.get("video_file")
    if video_file:
        file_path = UPLOAD_FOLDER / video_file
        if file_path.exists() and file_path.is_file():
            file_path.unlink()
    return redirect(url_for('dashboard'))

@app.route("/cpu_usage")
def cpu_usage():
    cpu = psutil.cpu_percent(interval=0.5)
    ram = psutil.virtual_memory()
    net = psutil.net_io_counters()
    return {
        "cpu": cpu,
        "ram": ram.percent,
        "ram_used": int(ram.used / 1024 / 1024),
        "ram_total": int(ram.total / 1024 / 1024),
        "net_sent": round(net.bytes_sent / 1024 / 1024, 2),
        "net_recv": round(net.bytes_recv / 1024 / 1024, 2)
    }

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)