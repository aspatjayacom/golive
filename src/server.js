const os = require('os');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const he = require('he');
const path = require('path');
const database = require('./database');
const EventSource = require('eventsource');
const rateLimit = require('express-rate-limit');
const sharp = require('sharp');
const { google } = require('googleapis');
const drive = google.drive('v3');
const stream = require('stream');
const { exec } = require('child_process'); // Add this to execute shell commands
const app = express();

const thumbnailsDir = path.join(__dirname, 'thumbnails');
if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// ================== KONFIGURASI UTAMA ==================

// Fungsi untuk menghasilkan session secret secara acak
const generateSessionSecret = () => crypto.randomBytes(32).toString('hex');
const uploadsTempDir = path.join(__dirname, 'uploadsTemp');
if (!fs.existsSync(uploadsTempDir)) {
  fs.mkdirSync(uploadsTempDir, { recursive: true });
}
const uploadVideo = multer({ dest: uploadsTempDir });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/img');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, 'avatar.jpg')
});
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') cb(null, true);
    else cb(new Error('Hanya file JPG/JPEG yang diperbolehkan'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const avatarUpload = multer({
    storage: avatarStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/jpeg') {
            return cb(new Error('Only JPG files are allowed'));
        }
        cb(null, true);
    }
});

// Setup middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'thumbnails')));
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: generateSessionSecret(),
  resave: true,
  saveUninitialized: false,
  cookie: { secure: false, sameSite: 'lax', maxAge: 1000 * 60 * 60 }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 7,
    message: {
        success: false,
        message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.'
        });
    }
});

// ================== ROUTING DASAR ==================
app.get('/', async (req, res) => handleRootRoute(req, res));
app.get('/login', async (req, res) => handleRootRoute(req, res));

async function handleRootRoute(req, res) {
  const userCount = await new Promise((resolve, reject) => {
    database.getUserCount((err, count) => {
      if (err) {
        console.error("Error getting user count:", err);
        return res.status(500).send("Internal Server Error");
      }
      resolve(count);
    });
  });

  if (userCount > 0) {
    if (req.session.user) {
      return res.redirect('/dashboard');
    } else {
      return res.sendFile(path.join(__dirname, '../public/login.html'));
    }
  } else {
    return res.redirect('/setup');
  }
}

// ================== AUTENTIKASI ==================

// Middleware untuk melindungi halaman HTML dan API
const requireAuthHTML = (req, res, next) => {
  if (!req.session.user) return res.redirect('/login');
  next();
};
const requireAuthAPI = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
};

// API untuk mendapatkan username dari sesi
app.get('/api/user', requireAuthAPI, (req, res) => {
  res.json({ username: req.session.user.username });
});

// ================== ROUTING UTAMA ==================

app.get('/', (req, res) => res.redirect('/login'));

app.get('/history', requireAuthHTML, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/history.html'));
});

app.get('/api/history', requireAuthAPI, (req, res) => {
  database.getHistoryStreamContainers((err, rows) => {
    if (err) return sendError(res, err.message);
    const historyData = rows.map(row => ({
      id: row.id,
      title: row.title,
      video_path: row.video_path,
      platform: row.stream_url && row.stream_url.startsWith('http') ? new URL(row.stream_url).hostname : 'Unknown',
      created_at: row.created_at,
    }));
    res.json(historyData);
  });
});

app.delete('/delete-history/:id', requireAuthAPI, (req, res) => {
  const historyId = req.params.id;
  database.deleteStreamHistory(historyId, (err) => {
    if (err) return sendError(res, err.message);
    res.json({ message: 'History streaming berhasil dihapus' });
  });
});

app.get('/gallery', requireAuthHTML, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/gallery.html'));
});

app.get('/settings', requireAuthHTML, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/settings.html'));
});

// ================== MANAJEMEN USER ==================

// Endpoint untuk mendapatkan salt
app.get('/get-salt/:username', loginLimiter, async (req, res) => {
  const username = req.params.username;
  
  try {
    const user = await new Promise((resolve, reject) => {
      database.getUserSalt(username, (err, salt) => {
        if (err) reject(err);
        resolve(salt);
      });
    });
    
    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }
    
    res.json({ success: true, salt: user.salt });
  } catch (error) {
    console.error('Get salt error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan' });
  }
});

app.post('/login', loginLimiter, async (req, res) => {
  const { username, hashedPassword } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      database.verifyUser(username, hashedPassword, (err, user) => {
        if (err) reject(err);
        resolve(user);
      });
    });

    if (!user) {
      return res.json({ success: false, message: 'Username atau password salah' });
    }

    req.session.user = { username: username };
    req.session.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan' });
  }
});

app.get('/check-auth', (req, res) => res.json({ authenticated: !!req.session.user }));
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Gagal logout' });
    res.redirect('/login');
  });
});

// ================== DASHBOARD ==================

app.get('/dashboard', requireAuthHTML, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

// ================== PENGATURAN USER ==================

// Endpoint update-settings
app.post('/update-settings', requireAuthAPI, uploadAvatar.single('avatar'), async (req, res) => {
  const { username, hashedPassword, salt } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      database.getUser(req.session.user.username, (err, user) => {
        if (err) reject(err);
        resolve(user);
      });
    });

    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    const userId = user.id;

    if (username && username !== req.session.user.username) {
      await new Promise((resolve, reject) => {
        database.updateUser(userId, { username }, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
      req.session.user.username = username;
    }

    if (hashedPassword && salt) {
      await new Promise((resolve, reject) => {
        database.updateUser(userId, { 
          password_hash: hashedPassword,
          salt: salt 
        }, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    }

    res.json({ 
      success: true, 
      message: 'Perubahan berhasil disimpan!',
      timestamp: Date.now() 
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Gagal mengupdate pengaturan' 
    });
  }
});

app.post('/api/settings/update', requireAuthAPI, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  
  try {
    const user = await new Promise((resolve, reject) => {
      database.getUser(req.session.user.username, (err, user) => {
        if (err) reject(err);
        resolve(user);
      });
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    if (username && username !== user.username) {
      await new Promise((resolve, reject) => {
        database.updateUser(user.id, { username }, (err) => {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error('Username sudah digunakan'));
            } else {
              reject(err);
            }
          }
          req.session.user.username = username;
          resolve();
        });
      });
    }

    if (currentPassword && newPassword) {
      const currentHash = CryptoJS.SHA256(currentPassword + user.salt).toString();
      
      if (currentHash !== user.password_hash) {
        return res.status(400).json({
          success: false,
          message: 'Password saat ini tidak sesuai'
        });
      }

      const newSalt = CryptoJS.lib.WordArray.random(16).toString();
      const newHash = CryptoJS.SHA256(newPassword + newSalt).toString();

      await new Promise((resolve, reject) => {
        database.updateUser(user.id, {
          password_hash: newHash,
          salt: newSalt
        }, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    }

    res.json({
      success: true,
      message: 'Pengaturan berhasil diperbarui'
    });

  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({
      success: false, 
      message: error.message || 'Gagal memperbarui pengaturan'
    });
  }
});

app.get('/api/user/profile', requireAuthAPI, async (req, res) => {
  try {
    const user = await new Promise((resolve, reject) => {
      database.getUser(req.session.user.username, (err, user) => {
        if (err) reject(err);
        resolve(user);
      });
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    res.json({
      success: true,
      username: user.username
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ================== MANAJEMEN VIDEO ==================

app.post('/upload-video', uploadVideo.single('video'), (req, res) => {
  if (!req.file) return sendError(res, 'Tidak ada file yang diupload');

  const uploadsDir = path.join(__dirname, 'uploads');
  const newFilePath = path.join(uploadsDir, req.file.originalname);

  if (fs.existsSync(newFilePath)) {
    fs.unlink(newFilePath, (err) => {
      if (err) {
        console.error('Error deleting existing file:', err);
        return sendError(res, 'Gagal menghapus file yang sudah ada');
      }
      saveNewFile();
    });
  } else {
    saveNewFile();
  }

  function saveNewFile() {
    fs.rename(req.file.path, newFilePath, (err) => {
      if (err) {
        console.error('Error moving uploaded file:', err);
        return sendError(res, 'Gagal mengupload video');
      }
      res.json({ message: 'Upload berhasil', filePath: newFilePath });
    });
  }
});

app.post('/delete-video', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return sendError(res, 'File path diperlukan');
  const isAbsolute = path.isAbsolute(filePath);
  const fullFilePath = isAbsolute ? filePath : path.join(__dirname, 'uploads', filePath);
  fs.unlink(fullFilePath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
      return sendError(res, 'Gagal menghapus file');
    }
    res.json({ message: 'File berhasil dihapus' });
  });
});

app.get('/video/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  fs.stat(filePath, (err, stat) => {
    if (err) {
      if (err.code === 'ENOENT') return res.status(404).send('File not found');
      else return res.status(500).send('File system error');
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size
    });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

// Endpoint untuk streaming video
app.get('/uploads/:filename', (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(__dirname, 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Video not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        if (start >= fileSize || end >= fileSize) {
            res.status(416).send('Requested range not satisfiable');
            return;
        }

        const file = fs.createReadStream(filePath, {start, end});
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };

        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
    }
});

// Endpoint untuk mendapatkan list video dari folder uploads
app.get('/api/videos', requireAuthAPI, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 8;
  const offset = (page - 1) * limit;
  const uploadsDir = path.join(__dirname, 'uploads');

  try {
    const allFiles = fs.readdirSync(uploadsDir)
      .filter(file => {
        const isVideoFile = ['.mp4', '.mkv', '.avi'].includes(path.extname(file).toLowerCase());
        const isNotStreamingFile = !file.startsWith('streamflow_videodata_');
        return isVideoFile && isNotStreamingFile;
      });

    const totalStorage = allFiles.reduce((acc, file) => {
      const stats = fs.statSync(path.join(uploadsDir, file));
      return acc + stats.size / (1024 * 1024);
    }, 0);

    const sortedFiles = allFiles.sort((a, b) => {
      const statA = fs.statSync(path.join(uploadsDir, a));
      const statB = fs.statSync(path.join(uploadsDir, b));
      return statB.mtime.getTime() - statA.mtime.getTime();
    });

    const paginatedFiles = sortedFiles.slice(offset, offset + limit);

    const videosWithInfo = await Promise.all(paginatedFiles.map(async file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      const duration = await new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            resolve('00:00');
            return;
          }
          const seconds = metadata.format.duration;
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.floor(seconds % 60);
          resolve(`${minutes}:${remainingSeconds.toString().padStart(2, '0')}`);
        });
      });

      return {
        name: file,
        path: `/uploads/${file}`,
        size: (stats.size / (1024 * 1024)).toFixed(2),
        modified: stats.mtime,
        type: 'video/mp4',
        duration
      };
    }));

    res.json({
      videos: videosWithInfo,
      total: allFiles.length,
      currentPage: page,
      totalPages: Math.ceil(allFiles.length / limit),
      totalStorage: totalStorage.toFixed(2),
      hasMore: offset + limit < allFiles.length
    });

  } catch (err) {
    console.error('Error reading videos:', err);
    res.status(500).json({ error: 'Failed to read videos' });
  }
});

// Endpoint untuk daftar video di popup tambah video
app.get('/api/videos-all', requireAuthAPI, async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const files = await fs.promises.readdir(uploadsDir);
    const videoList = await Promise.all(
      files
        .filter(file => {
          const isVideoFile = file.match(/\.(mp4|mkv|avi|mov|wmv)$/i);
          const isNotStreamingFile = !file.startsWith('streamflow_videodata_');
          return isVideoFile && isNotStreamingFile;
        })
        .map(async (file) => {
          const filePath = path.join(uploadsDir, file);
          const stats = await fs.promises.stat(filePath);
        
          const duration = await new Promise((resolve) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
              if (err) {
                console.error('Error getting duration:', err);
                resolve('00:00');
                return;
              }
              const seconds = metadata.format.duration;
              const minutes = Math.floor(seconds / 60);
              const remainingSeconds = Math.floor(seconds % 60);
              resolve(`${minutes}:${remainingSeconds.toString().padStart(2, '0')}`);
            });
          });
          
          return {
            name: file,
            path: `/uploads/${file}`,
            duration: duration,
            size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
            created: stats.birthtime
          };
        })
    );

    videoList.sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json({ 
      success: true,
      videos: videoList || [] 
    });

  } catch (error) {
    console.error('Error reading videos directory:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to read videos directory',
      videos: [] 
    });
  }
});

// ================== STREAMING ==================

const streams = {};
const monitorStreams = new Map();

app.post('/start-stream', async (req, res) => {
  try {
    const { rtmp_url, stream_key, loop, title, videoPath, schedule_duration } = req.body;

    if (!videoPath || !title || !schedule_duration) {
      return sendError(res, 'Data tidak lengkap. Pastikan video, judul, dan durasi sudah diisi.');
    }

    const sourceFilePath = path.join(__dirname, 'uploads', videoPath);
    if (!fs.existsSync(sourceFilePath)) {
      return sendError(res, 'Video tidak ditemukan di server.');
    }

    const fullRtmpUrl = `${rtmp_url}/${stream_key}`;
    const durationMs = parseInt(schedule_duration, 10) * 60 * 1000; // Convert minutes to milliseconds

    const command = ffmpeg(sourceFilePath)
      .inputFormat('mp4')
      .inputOptions(['-nostdin', '-re', ...(loop ? ['-stream_loop -1'] : [])])
      .outputOptions(['-c:v copy', '-c:a copy', '-threads 0', '-f flv'])
      .output(fullRtmpUrl);

    command
      .on('start', async () => {
        console.log(`Streaming dimulai: ${stream_key}`);
        await database.saveStreamContainer({
          stream_key,
          title,
          video_path: videoPath,
          stream_url: rtmp_url,
          is_streaming: 1,
          schedule_duration,
        });
      })
      .on('end', async () => {
        console.log(`Streaming selesai: ${stream_key}`);
        if (streams[stream_key]) {
          streams[stream_key].command.kill('SIGKILL'); // Ensure ffmpeg process is terminated
          delete streams[stream_key];
        }
        await database.updateStreamContainer(stream_key, { is_streaming: 0 });
        await database.addStreamHistory({ stream_key, title, videoPath });
      })
      .on('error', async (err) => {
        console.error(`Error streaming: ${err.message}`);
        if (streams[stream_key]) {
          streams[stream_key].command.kill('SIGKILL'); // Ensure ffmpeg process is terminated on error
          delete streams[stream_key];
        }
        await database.updateStreamContainer(stream_key, { is_streaming: 0 });
      });

    command.run();
    streams[stream_key] = { command, startTime: Date.now(), title, videoPath };

    // Automatically stop the stream after the specified duration
    setTimeout(async () => {
      if (streams[stream_key]) {
        streams[stream_key].command.kill('SIGKILL'); // Ensure ffmpeg process is terminated
        const { title, videoPath } = streams[stream_key];
        delete streams[stream_key];
        console.log(`Streaming otomatis dihentikan setelah ${schedule_duration} menit.`);
        await database.updateStreamContainer(stream_key, { is_streaming: 0 });
        await database.addStreamHistory({ stream_key, title, videoPath });
      }
    }, durationMs);

    res.json({ message: 'Streaming dimulai', stream_key });
  } catch (error) {
    console.error('Error starting stream:', error);
    sendError(res, 'Gagal memulai streaming.');
  }
});

app.post('/stop-stream', async (req, res) => {
  const { stream_key } = req.body;
  const stream = streams[stream_key];

  if (stream) {
    try {
      stream.command.kill('SIGKILL'); // Ensure ffmpeg process is terminated
      const { title, videoPath } = stream;
      delete streams[stream_key];
      database.updateStreamContainer(stream_key, { is_streaming: 0 });
      database.addStreamHistory({ stream_key, title, videoPath });

      res.json({ message: 'Streaming dihentikan' });
    } catch (error) {
      console.error('Error stopping stream:', error);
      sendError(res, 'Gagal menghentikan stream: ' + error.message);
    }
  } else {
    sendError(res, 'Stream tidak ditemukan', 404);
  }
});

app.get('/stream-containers', requireAuthAPI, (req, res) => {
  database.getStreamContainers((err, rows) => {
    if (err) return sendError(res, err.message);
    res.json(rows);
  });
});

app.get('/active-stream-containers', requireAuthAPI, (req, res) => {
  database.getActiveStreamContainers((err, rows) => {
    if (err) return sendError(res, err.message);
    res.json(rows);
  });
});

// Endpoint untuk status streaming
app.get('/stream-status/:streamKey', (req, res) => {
  const streamKey = req.params.streamKey;
  const stream = streams[streamKey];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  if (!stream) {
    res.write(`data: ${JSON.stringify({ 
      is_streaming: false,
      auto_stopped: true
    })}\n\n`);
    return res.end();
  }

  if (!monitorStreams.has(streamKey)) {
    monitorStreams.set(streamKey, {
      lastCheck: Date.now(),
      isActive: true
    });
  }

  const intervalId = setInterval(() => {
    const monitor = monitorStreams.get(streamKey);
    if (!monitor || !monitor.isActive) {
      clearInterval(intervalId);
      res.end();
      return;
    }

    try {
      if (stream && stream.process) {
        process.kill(stream.process.ffmpegProc.pid, 0);
        res.write(`data: ${JSON.stringify({ is_streaming: true })}\n\n`);
        monitor.lastCheck = Date.now();
      } else {
        throw new Error('Process not found');
      }
    } catch (e) {
      clearInterval(intervalId);
      res.end();
    }
  }, 5000);

  res.on('close', () => {
    clearInterval(intervalId);
  });
});

app.get('/api/active-lives', requireAuthAPI, async (req, res) => {
  try {
    const activeLives = await new Promise((resolve, reject) => {
      database.getActiveStreamContainers((err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    const formattedLives = activeLives.map(live => ({
      id: live.id,
      title: live.title,
      stream_key: live.stream_key,
      stream_url: live.stream_url,
      video_path: live.video_path,
      is_streaming: live.is_streaming === 1,
      schedule_duration: live.schedule_duration,
      schedule_enabled: live.schedule_enabled === 1,
      schedule_duration_enabled: live.schedule_duration_enabled === 1,
    }));

    res.setHeader('Cache-Control', 'no-store'); // Disable caching
    res.json(formattedLives);
  } catch (error) {
    console.error('Error fetching active lives:', error);
    res.status(500).json({ error: 'Failed to fetch active lives' });
  }
});

// ================== SETUP AKUN ==================

app.get('/setup', async (req, res) => {
  const userCount = await new Promise((resolve, reject) => {
    database.getUserCount((err, count) => {
      if (err) reject(err);
      resolve(count);
    });
  });
  if (userCount > 0) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, '../public/setup.html'));
});

app.post('/setup', uploadAvatar.single('avatar'), async (req, res) => {
  const { username, hashedPassword, salt } = req.body;
  
  if (!username || !hashedPassword || !salt) {
    return sendError(res, 'Data tidak lengkap');
  }

  try {
    await new Promise((resolve, reject) => {
      database.addUser(username, hashedPassword, salt, (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    req.session.user = { username: username };
    req.session.save();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Setup akun error:', error);
    sendError(res, error.message || 'Gagal membuat akun');
  }
});

// ================== HELPER FUNCTIONS ==================

const sendError = (res, message, status = 400) =>
  res.status(status).json({ success: false, message });

const handleServerError = (res, err) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
};

const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
  });
};

const generateRandomFileName = () => `streamflow_videodata_${crypto.randomBytes(16).toString('hex')}`;
const ifaces = os.networkInterfaces();
let ipAddress = 'localhost';
for (const iface of Object.values(ifaces)) {
  for (const alias of iface) {
    if (alias.family === 'IPv4' && !alias.internal) {
      ipAddress = alias.address;
      break;
    }
  }
  if (ipAddress !== 'localhost') break;
}


async function generateThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: [0],
        filename: 'thumbnail.jpg',
        folder: path.dirname(outputPath)
      })
      .on('end', async () => {
        await sharp(path.join(path.dirname(outputPath), 'thumbnail.jpg'))
          .resize(320, 180)
          .jpeg({ quality: 80 })
          .toFile(outputPath);
        resolve();
      })
      .on('error', reject);
  });
};

// Endpoint untuk generate thumbnail
app.get('/thumbnails/:filename', async (req, res) => {
    const videoPath = path.join(__dirname, 'uploads', req.params.filename);
    const thumbnailPath = path.join(__dirname, 'thumbnails', `${req.params.filename}.jpg`);
    const thumbnailsDir = path.join(__dirname, 'thumbnails');
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
    }

    try {
        if (!fs.existsSync(thumbnailPath)) {
            if (!fs.existsSync(videoPath)) {
                return res.status(404).send('Video not found');
            }

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .screenshots({
                        count: 1,
                        folder: thumbnailsDir,
                        filename: `${req.params.filename}.jpg`,
                        size: '480x270'
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });
        }

        res.sendFile(thumbnailPath);
    } catch (error) {
        console.error('Error handling thumbnail:', error);
        res.status(500).send('Error generating thumbnail');
    }
});

// Endpoint untuk Google Drive API key
app.get('/api/drive-api-key', requireAuthAPI, async (req, res) => {
  try {
    const apiKey = await database.getSetting('drive_api_key');
    res.json({ apiKey });
  } catch (error) {
    sendError(res, 'Failed to get API key');
  }
});

// Endpoint untuk menyimpan API key
app.post('/api/drive-api-key', requireAuthAPI, async (req, res) => {
  const { apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ 
      success: false, 
      message: 'API key tidak boleh kosong' 
    });
  }

  try {
    await database.saveSetting('drive_api_key', apiKey);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving API key:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menyimpan API key'
    });
  }
});

// Endpoint upload avatar
app.post('/upload-avatar', requireAuthAPI, avatarUpload.single('avatar'), (req, res) => {
    try {
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\x1b[32mStreamFlow berjalan\x1b[0m\nAkses aplikasi di \x1b[34mhttp://${ipAddress}:${PORT}\x1b[0m`);
});
