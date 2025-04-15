fetch('/check-auth', { credentials: 'include' })
  .then(response => response.json())
  .then(data => {
    if (!data.authenticated && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    if (data.authenticated && window.location.pathname === '/login') {
      window.location.href = '/dashboard';
    }
  });

async function loadContainers() {
  const containersDiv = document.getElementById('containers');
  const defaultMessage = document.getElementById('defaultMessage');

  containersDiv.innerHTML = '';

  try {
    const response = await fetch('/active-stream-containers', { credentials: 'include' });
    if (response.ok) {
      const containersData = await response.json();
      containersData.forEach(containerData => {
        const enhancedData = {
          ...containerData,
          schedule_enabled: containerData.schedule_enabled || false,
          schedule_duration_enabled: containerData.schedule_duration_enabled || false,
          schedule_duration: containerData.schedule_duration || ''
        };
        createContainer(enhancedData);
      });
    }
    checkContainers(containersDiv, defaultMessage);
  } catch (error) {
    console.error('Error fetching active containers:', error);
  }
}

async function loadActiveLives() {
  const containersDiv = document.getElementById('containers');
  const defaultMessage = document.getElementById('defaultMessage');

  containersDiv.innerHTML = ''; // Clear existing containers

  try {
    const response = await fetch(`/api/active-lives?timestamp=${Date.now()}`, { credentials: 'include' }); // Add cache-busting query parameter
    if (response.ok) {
      const activeLives = await response.json();
      if (activeLives.length > 0) {
        activeLives.forEach(live => {
          createContainer({
            id: live.id,
            title: live.title,
            stream_key: live.stream_key,
            stream_url: live.stream_url,
            preview_file: live.video_path,
            is_streaming: live.is_streaming,
            schedule_duration: live.schedule_duration,
            schedule_enabled: live.schedule_enabled,
            schedule_duration_enabled: live.schedule_duration_enabled,
          });
        });
        defaultMessage.classList.add('hidden'); // Hide the default message
      } else {
        defaultMessage.classList.remove('hidden'); // Show the default message if no lives are active
      }
    } else {
      console.error('Failed to fetch active lives:', response.statusText);
      defaultMessage.classList.remove('hidden'); // Show the default message on error
    }
  } catch (error) {
    console.error('Error loading active lives:', error);
    defaultMessage.classList.remove('hidden'); // Show the default message on error
  }
}

function updateContainerNumbers(containersDiv) {
  const containers = containersDiv.querySelectorAll('.container-header');
  containers.forEach((container, index) => {
    const numberElement = container.querySelector('span:first-child');
    numberElement.textContent = `${index + 1} -`;
  });
}

function checkContainers(containersDiv, defaultMessage) {
  if (containersDiv.children.length === 0) {
    defaultMessage.classList.remove('hidden');
  } else {
    defaultMessage.classList.add('hidden');
  }
}

function createContainer(containerData) {
  const containersDiv = document.getElementById('containers');
  const defaultMessage = document.getElementById('defaultMessage');
  let containerCount = containersDiv.children.length + 1;
  let title = containerData?.title || 'Live Baru';
  let streamKey = containerData?.stream_key || '';
  let streamUrl = containerData?.stream_url || 'rtmp://a.rtmp.youtube.com/live2';
  let loop = containerData?.loop_enabled !== 0;
  let previewFile = containerData?.preview_file || null;
  let isStreaming = containerData?.is_streaming === 1;
  let scheduleEnabled = containerData?.schedule_enabled === 1;
  let scheduleDurationEnabled = containerData?.schedule_duration_enabled === 1;

  const container = document.createElement('div');
  container.className = 'bg-white shadow-lg rounded-xl p-6 relative';
  container.dataset.streamKey = streamKey;
  container.dataset.containerId = containerData?.id;
  container.dataset.filePath = previewFile;

  container.innerHTML = `
    <div class="container-header flex justify-between items-center">
      <div class="flex items-center gap-2">
        <span class="text-gray-600">${containerCount} -</span>
        <span class="container-title font-medium">${title}</span>
        <button class="edit-title ml-2 text-gray-500 hover:text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
        </button>
      </div>
      <button class="remove-container text-gray-600 hover:text-red-500 ${isStreaming ? 'cursor-not-allowed' : ''}" ${isStreaming ? 'disabled' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="relative aspect-video bg-black flex items-center justify-center overflow-hidden rounded-lg">
      <div class="text-white">
        <button class="bg-transparent border-2 border-white text-white px-4 py-2 rounded-lg hover:bg-white/20 select-video">
          <i class="fa-regular fa-image mr-2"></i>Pilih Video
        </button>
      </div>
      <video class="w-full h-full object-contain ${previewFile ? '' : 'hidden'}" preload="metadata"></video>
      <input type="file" class="hidden" accept="video/*" > 
      <div class="absolute inset-0 flex items-center justify-center text-white text-sm upload-status hidden">
        <span>Uploading <span class="upload-percentage">0%</span></span>
        <button class="text-red-500 hover:text-red-700 ml-2 cancel-upload">Cancel</button>
      </div>
    </div>
    <div class="mt-3 flex justify-end items-center">
      <label class="switch">
        <input type="checkbox" class="loop-video" ${loop ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
      <span class="text-sm text-gray-700 ml-2">Loop Video</span>
    </div>
    <div class="mt-4 relative">
      <input placeholder="Stream Key" class="w-full p-2 border rounded-lg stream-key text-sm pr-10" type="password" value="${streamKey}">
      <button class="absolute right-2 top-2 text-gray-500 hover:text-gray-700 toggle-password">
        <svg id="eyeIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye w-5 h-5">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    </div>
    <div class="mt-4">
      <input placeholder="Stream URL" class="w-full text-sm p-2 border rounded-lg stream-url" value="${streamUrl}">
    </div>
    <div class="mt-4">
      <!-- Removed Bitrate, Resolution, and FPS inputs -->
    </div>
    <div class="mt-4">
      <div class="flex items-center justify-between">
        <h3 class="block text-sm font-medium mb-2 text-gray-700">Durasi Live</h3>
      </div>
      <div class="relative">
        <input 
          type="number" 
          class="schedule-duration text-sm w-full p-2 border rounded-lg pr-16 bg-gray-50" 
          min="1"
          max="1440"
          value="${containerData?.schedule_duration || ''}"
          placeholder="Durasi dalam menit"
        >
        <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <span class="text-gray-500 text-sm">menit</span>
        </div>
      </div>
    </div>
    <div class="pt-3"><hr></div>
    <div class="mt-4 flex justify-between items-center">
      <div class="flex gap-2">
        <button class="bg-green-500 text-white px-4 py-2 rounded-lg start-stream hover:bg-green-600 transition-all ${isStreaming ? 'hidden' : ''}">Start</button>
        <button class="bg-red-500 text-white px-4 py-2 rounded-lg stop-stream ${isStreaming ? '' : 'hidden'} hover:bg-red-600 transition-all">Stop</button>
        <button class="bg-gray-500 text-white px-4 py-2 rounded-lg remove-video ${previewFile ? '' : 'hidden'} hover:bg-gray-600 transition-all">Ganti Video</button>
      </div>
      <div class="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 live-notif hidden">
        <i class="fa-solid fa-circle mr-1 animate-pulse " style="font-size: 8px;"></i>LIVE
      </div>
    </div>
    <div class="fixed inset-0 bg-black/50 hidden items-center justify-center gallery-modal z-50">
      <div class="bg-white rounded-xl w-full max-w-4xl flex flex-col" style="height: 80vh">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-semibold">Pilih Video</h3>
          <div class="flex items-center gap-4">
            <!-- Tambah input pencarian -->
            <div class="relative">
              <input type="text" 
                class="search-video px-3 py-1.5 pr-8 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
                placeholder="Cari video...">
              <i class="fa-solid fa-search absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"></i>
            </div>
            <a href="/gallery" class="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              <i class="fa-solid fa-arrow-up-from-bracket mr-2"></i>
              Upload
            </a>
            <button class="close-gallery text-gray-500 hover:text-gray-700">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-4"> <!-- Container yang bisa di-scroll -->
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4 gallery-container">
            <!-- Videos will be loaded here -->
          </div>
        </div>
      </div>
    </div>
  `;

  containersDiv.appendChild(container);

  addStreamKeyToggle(container);
  addVideoSelector(container);
  addStartStream(container);
  addStopStream(container);
  addChangeVideo(container);
  addRemoveContainer(container);
  addEditTitle(container);
  addLoopVideo(container);
  addOrientationToggle(container);
  updateContainerNumbers(containersDiv);
  checkContainers(containersDiv, defaultMessage);

  const videoElement = container.querySelector('video');
  const selectVideoBtn = container.querySelector('.select-video');
  const removeVideoBtn = container.querySelector('.remove-video');
  const stopStreamBtn = container.querySelector('.stop-stream');
  const liveNotif = container.querySelector('.live-notif');
  videoElement.loop = loop;

  if (previewFile) {
    const videoURL = `/video/${previewFile}`;
    videoElement.src = videoURL;
    videoElement.classList.remove('hidden');
    videoElement.controls = true;
    videoElement.volume = 0;
    videoElement.onloadedmetadata = function() {
      this.pause();
    }
    
    selectVideoBtn.classList.add('hidden');
    removeVideoBtn.classList.remove('hidden');
    
    if (!stopStreamBtn.classList.contains('hidden')) {
      removeVideoBtn.disabled = true;
      removeVideoBtn.classList.add('cursor-not-allowed');
      liveNotif.classList.remove('hidden');
    } else {
      removeVideoBtn.disabled = false;
      removeVideoBtn.classList.remove('cursor-not-allowed');
      liveNotif.classList.add('hidden');
    }
  } else {
    removeVideoBtn.disabled = false;
    removeVideoBtn.classList.remove('cursor-not-allowed');
    liveNotif.classList.add('hidden');
  }

  const scheduleSwitch = container.querySelector('.schedule-switch');
  const scheduleSettings = container.querySelector('.schedule-settings');
  const durationInput = container.querySelector('.schedule-duration');

  if (containerData.schedule_enabled) {
    scheduleSwitch.checked = true;
    scheduleSettings.classList.remove('hidden');

    if (containerData.schedule_duration_enabled) {
      durationInput.value = containerData.schedule_duration;
    }
  }

  scheduleSwitch.addEventListener('change', () => {
    if (scheduleSwitch.checked) {
      scheduleSettings.classList.remove('hidden');
    } else {
      scheduleSettings.classList.add('hidden');
      durationInput.value = '';
    }
  });

  durationInput.addEventListener('input', () => {
    if (durationInput.value < 1 || durationInput.value > 1440) {
      durationInput.setCustomValidity('Durasi harus antara 1 hingga 1440 menit');
    } else {
      durationInput.setCustomValidity('');
    }
  });

  if (previewFile) {
    videoElement.src = `/video/${previewFile}`;
    videoElement.classList.remove('hidden');
    videoElement.controls = true;
    videoElement.volume = 0;
    selectVideoBtn.classList.add('hidden');
    removeVideoBtn.classList.remove('hidden');
  }

  if (scheduleEnabled) {
    scheduleSwitch.checked = true;
    scheduleSettings.classList.remove('hidden');
  }

  if (scheduleDurationEnabled) {
    durationInput.value = containerData.schedule_duration;
  }

  selectVideoBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/gallery-videos');
      const data = await response.json();
      
      if (!data.videos || data.videos.length === 0) {
        galleryContainer.innerHTML = `
          <div class="text-center text-gray-500">
            <p>Tidak ada video tersedia.</p>
            <p class="text-sm">Upload video di halaman Galeri.</p>
          </div>
        `;
      } else {
        galleryContainer.innerHTML = data.videos.map(video => `
          <div class="video-item cursor-pointer rounded-lg overflow-hidden border hover:border-blue-500 transition-colors"
               data-path="/video/${video.name}" 
               data-name="${video.name}">
          </div>
        `).join('');

        galleryContainer.querySelectorAll('.video-item').forEach(item => {
          item.addEventListener('click', () => {

          });
        });
      }
    } catch (error) {
      console.error('Error loading gallery:', error);
    }
  });

  const startStreamBtn = container.querySelector('.start-stream');

  startStreamBtn.addEventListener('click', async () => {
    startStreamBtn.disabled = true;
    startStreamBtn.textContent = 'Please wait...';
    startStreamBtn.classList.remove('bg-green-500');
    startStreamBtn.classList.add('bg-gray-500');

    const streamKey = streamKeyInput.value;
    const streamUrl = streamUrlInput.value;
    const loop = loopVideoCheckbox.checked;
    const title = containerTitle.textContent;
    const filePath = container.dataset.filePath;
    const duration = parseInt(durationInput.value) * 60 * 1000; // Convert minutes to milliseconds

    if (!streamKey || !filePath || !duration || duration < 1) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Input',
        text: 'Pastikan Stream Key, Video, dan Durasi sudah diisi dengan benar!',
      });
      startStreamBtn.disabled = false;
      startStreamBtn.textContent = 'Start';
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
      return;
    }

    try {
      const response = await fetch('/start-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtmp_url: streamUrl,
          stream_key: streamKey,
          loop,
          title,
          videoPath: filePath,
          schedule_duration: durationInput.value, // Send duration in minutes
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to start streaming');

      Swal.fire({
        icon: 'success',
        title: 'Streaming Dimulai',
        text: `Streaming akan berjalan selama ${durationInput.value} menit.`,
      });

      startStreamBtn.classList.add('hidden');
      stopStreamBtn.classList.remove('hidden');
      liveNotif.classList.remove('hidden');
    } catch (error) {
      console.error('Error starting stream:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memulai Streaming',
        text: error.message || 'Terjadi kesalahan saat memulai streaming.',
      });
      startStreamBtn.disabled = false;
      startStreamBtn.textContent = 'Start';
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
    }
  });

  if (containerData.is_streaming === 1) {
    const scheduleStart = containerData.schedule_start ? new Date(containerData.schedule_start).getTime() : null;
    const now = Date.now();

    if (scheduleStart && scheduleStart > now) {
      startStreamBtn.textContent = 'Batalkan Jadwal';
      startStreamBtn.classList.remove('bg-green-500', 'hidden');
      startStreamBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
      stopStreamBtn.classList.add('hidden');
      liveNotif.classList.add('hidden');

      const newStartBtn = startStreamBtn.cloneNode(true);
      startStreamBtn.parentNode.replaceChild(newStartBtn, startStreamBtn);
      
      newStartBtn.addEventListener('click', async () => {
        try {
          const result = await Swal.fire({
            icon: 'warning',
            title: 'Batalkan Jadwal?',
            text: 'Streaming tidak akan dimulai jika jadwal dibatalkan',
            showCancelButton: true,
            confirmButtonText: 'Ya, Batalkan',
            cancelButtonText: 'Tidak',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6'
          });

          if (result.isConfirmed) {
            const response = await fetch(`/cancel-schedule/${containerData.stream_key}`, {
              method: 'POST',
              credentials: 'include'
            });

            if (!response.ok) {
              throw new Error('Gagal membatalkan jadwal');
            }

            newStartBtn.textContent = 'Start';
            newStartBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            newStartBtn.classList.add('bg-green-500', 'hover:bg-green-600');

            scheduleSwitch.checked = false;
            durationInput.value = '';
            scheduleSettings.classList.add('hidden');

            await Swal.fire({
              icon: 'success',
              title: 'Jadwal Dibatalkan',
              timer: 1500
            });
          }
        } catch (error) {
          console.error('Error canceling schedule:', error);
          Swal.fire({
            icon: 'error',
            title: 'Gagal Membatalkan Jadwal',
            text: error.message
          });
        }
      });
    } else {
      startStreamBtn.classList.add('hidden');
      stopStreamBtn.classList.remove('hidden');
      stopStreamBtn.classList.add('bg-red-500', 'hover:bg-red-600');
      
      if (!scheduleStart) {
        liveNotif.classList.remove('hidden');
      } else {
        liveNotif.classList.add('hidden');
      }
    }
  } else {
    startStreamBtn.textContent = 'Start';
    startStreamBtn.classList.remove('hidden', 'bg-yellow-500');
    startStreamBtn.classList.add('bg-green-500');
    stopStreamBtn.classList.add('hidden');
    liveNotif.classList.add('hidden');
  }

  return container;
}

function addStreamKeyToggle(container) {
  const togglePasswordBtn = container.querySelector('.toggle-password');
  const eyeIcon = container.querySelector('#eyeIcon');
  const streamKeyInput = container.querySelector('.stream-key');

  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = streamKeyInput.type === 'password';
    streamKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.classList.toggle('fa-eye');
    eyeIcon.classList.toggle('fa-eye-slash');
  });
}

function addVideoUpload(container) {
  let uploadController = null;
  let uploadedFilePath = null;

  const uploadVideoBtn = container.querySelector('.upload-video');
  const fileInput = container.querySelector('input[type="file"]');
  const videoElement = container.querySelector('video');
  const uploadStatus = container.querySelector('.upload-status');
  const uploadPercentage = container.querySelector('.upload-percentage');
  const startStreamBtn = container.querySelector('.start-stream');
  const removeVideoBtn = container.querySelector('.remove-video');

  uploadVideoBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadStatus.classList.remove('hidden');
      uploadVideoBtn.classList.add('hidden');
      startStreamBtn.disabled = true;
      startStreamBtn.classList.remove('bg-green-500');
      startStreamBtn.classList.add('bg-gray-500');
      removeVideoBtn.classList.add('hidden');

      const formData = new FormData();
      formData.append('video', file);

      uploadController = new AbortController();

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload-video', true);

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          uploadPercentage.textContent = `${percent}%`;
        }
      });

      xhr.onload = () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.response);
          uploadedFilePath = data.filePath;
          container.dataset.filePath = uploadedFilePath; 
          uploadStatus.classList.add('hidden');

          const videoURL = URL.createObjectURL(file);
          videoElement.src = videoURL;
          videoElement.classList.remove('hidden');
          videoElement.controls = true;
          videoElement.volume = 0;
          videoElement.play();

          removeVideoBtn.classList.remove('hidden');
          startStreamBtn.disabled = false;
          startStreamBtn.classList.remove('bg-gray-500');
          startStreamBtn.classList.add('bg-green-500');

        } else {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: `Upload Gagal! Status: ${xhr.status}`,
          });
        }
      };

      xhr.onerror = () => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Upload Gagal! Terjadi kesalahan.',
        });
        uploadStatus.classList.add('hidden');
        uploadVideoBtn.classList.remove('hidden');
        startStreamBtn.disabled = false;
        startStreamBtn.classList.remove('bg-gray-500');
        startStreamBtn.classList.add('bg-green-500');
        fileInput.value = '';
      };

      xhr.send(formData);
    }
  });

  const cancelUploadBtn = container.querySelector('.cancel-upload');
  cancelUploadBtn.addEventListener('click', () => {
    if (uploadController) {
      uploadController.abort();
      uploadController = null;

      if (uploadedFilePath) {
        fetch('/delete-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: uploadedFilePath }),
        })
          .then(response => response.json())
          .then(data => {
          })
          .catch(error => {
            console.error('Error deleting file:', error);
          });
      }

      uploadStatus.classList.add('hidden');
      uploadVideoBtn.classList.remove('hidden');
      startStreamBtn.disabled = false;
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
      fileInput.value = '';
    }
  });

  removeVideoBtn.addEventListener('click', () => {
    if (uploadedFilePath) {
      fetch('/delete-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: uploadedFilePath }),
      })
        .then(response => response.json())
        .then(data => {
        })
        .catch(error => {
          Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: error.message || 'Gagal menghapus video. Silakan coba lagi.',
          });
        });
    }

    videoElement.src = '';
    videoElement.classList.add('hidden');
    uploadVideoBtn.classList.remove('hidden');
    removeVideoBtn.classList.add('hidden');
    fileInput.value = '';
  });
}

function addStartStream(container) {
  const startStreamBtn = container.querySelector('.start-stream');
  const stopStreamBtn = container.querySelector('.stop-stream');
  const liveNotif = container.querySelector('.live-notif');
  const streamKeyInput = container.querySelector('.stream-key');
  const streamUrlInput = container.querySelector('.stream-url');
  const loopVideoCheckbox = container.querySelector('.loop-video');
  const containerTitle = container.querySelector('.container-title');
  const durationInput = container.querySelector('.schedule-duration');

  startStreamBtn.addEventListener('click', async () => {
    startStreamBtn.disabled = true;
    startStreamBtn.textContent = 'Please wait...';
    startStreamBtn.classList.remove('bg-green-500');
    startStreamBtn.classList.add('bg-gray-500');

    const streamKey = streamKeyInput.value;
    const streamUrl = streamUrlInput.value;
    const loop = loopVideoCheckbox.checked;
    const title = containerTitle.textContent;
    const filePath = container.dataset.filePath;
    const duration = parseInt(durationInput.value) * 60 * 1000; // Convert minutes to milliseconds

    if (!streamKey || !filePath || !duration || duration < 1) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Input',
        text: 'Pastikan Stream Key, Video, dan Durasi sudah diisi dengan benar!',
      });
      startStreamBtn.disabled = false;
      startStreamBtn.textContent = 'Start';
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
      return;
    }

    try {
      const response = await fetch('/start-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtmp_url: streamUrl,
          stream_key: streamKey,
          loop,
          title,
          videoPath: filePath,
          schedule_duration: durationInput.value, // Send duration in minutes
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to start streaming');

      Swal.fire({
        icon: 'success',
        title: 'Streaming Dimulai',
        text: `Streaming akan berjalan selama ${durationInput.value} menit.`,
      });

      startStreamBtn.classList.add('hidden');
      stopStreamBtn.classList.remove('hidden');
      liveNotif.classList.remove('hidden');
    } catch (error) {
      console.error('Error starting stream:', error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memulai Streaming',
        text: error.message || 'Terjadi kesalahan saat memulai streaming.',
      });
      startStreamBtn.disabled = false;
      startStreamBtn.textContent = 'Start';
      startStreamBtn.classList.remove('bg-gray-500');
      startStreamBtn.classList.add('bg-green-500');
    }
  });
}

function addStopStream(container) {
  const stopStreamBtn = container.querySelector('.stop-stream');
  const startStreamBtn = container.querySelector('.start-stream');
  const streamKeyInput = container.querySelector('.stream-key');
  const liveNotif = container.querySelector('.live-notif');
  const containersDiv = document.getElementById('containers');

  stopStreamBtn.addEventListener('click', async () => {
    const streamKey = streamKeyInput.value;

    if (!streamKey) {
      alert('Stream Key is required!');
      return;
    }

    stopStreamBtn.disabled = true;
    stopStreamBtn.textContent = 'Please wait...';
    stopStreamBtn.classList.remove('bg-red-500');
    stopStreamBtn.classList.add('bg-gray-500');

    try {
      const response = await fetch('/stop-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_key: streamKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Gagal menghentikan streaming';
        throw new Error(errorMessage);
      }

      Swal.fire({
        icon: 'success',
        title: 'Streaming Dihentikan',
        text: 'Live streaming berhasil dihentikan.',
      });

      container.remove(); // Remove the container after stopping the stream
      updateContainerNumbers(containersDiv);
      checkContainers(containersDiv, document.getElementById('defaultMessage'));
    } catch (error) {
      stopStreamBtn.disabled = false;
      stopStreamBtn.textContent = 'Stop';
      stopStreamBtn.classList.remove('bg-gray-500');
      stopStreamBtn.classList.add('bg-red-500');
      alert(`Error: ${error.message}`);
    }
  });
}

function addRemoveVideo(container) {
  const removeVideoBtn = container.querySelector('.remove-video');
  const videoElement = container.querySelector('video');
  const uploadVideoBtn = container.querySelector('.upload-video');
  const fileInput = container.querySelector('input[type="file"]');

  removeVideoBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/videos-all');
      const data = await response.json();

      if (!data.videos || data.videos.length === 0) {
        galleryContainer.innerHTML = `
          <div class="col-span-full h-[calc(80vh-100px)] flex flex-col items-center justify-center py-10 text-center">
            <div class="bg-gray-100 rounded-full p-4 mb-4">
              <i class="fa-regular fa-folder-open text-4xl text-gray-400"></i>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Tidak ada video</h3>
            <p class="text-sm text-gray-500 mb-4">Upload video terlebih dahulu di halaman Gallery</p>
            <a href="/gallery" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <i class="fa-solid fa-arrow-up-from-bracket mr-2"></i>
              Upload Video
            </a>
          </div>
        `;
      } else {
        galleryContainer.innerHTML = data.videos.map(video => `
          <div class="video-item cursor-pointer rounded-lg overflow-hidden border hover:border-blue-500 transition-colors"
               data-path="${video.path}" 
               data-name="${video.name}">
            <div class="aspect-video bg-black relative group">
              <img src="/thumbnails/${video.name}" class="w-full h-full object-contain" alt="${video.name}">
              <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-check text-2xl text-white"></i>
              </div>
            </div>
            <div class="p-2">
              <p class="text-sm truncate">${video.name}</p>
              <p class="text-xs text-gray-500">Durasi: ${video.duration}</p>
            </div>
          </div>
        `).join('');

        galleryContainer.querySelectorAll('.video-item').forEach(item => {
          item.addEventListener('click', () => {
            const videoPath = item.dataset.path;
            const videoName = item.dataset.name;

            videoElement.src = videoPath;
            videoElement.classList.remove('hidden');
            videoElement.controls = true;
            videoElement.volume = 0;
            videoElement.play();

            container.dataset.filePath = videoName;
            selectVideoBtn.classList.add('hidden');
            removeVideoBtn.classList.remove('hidden');
            galleryModal.classList.replace('flex', 'hidden');
          });
        });
      }

      galleryModal.classList.replace('hidden', 'flex');
    } catch (error) {
      console.error('Error loading videos:', error);
      Swal.fire('Error', 'Gagal memuat daftar video', 'error');
    }
  });
}

function addRemoveContainer(container) {
  const containersDiv = document.getElementById('containers');
  const removeButton = container.querySelector('.remove-container');

  removeButton.addEventListener('click', () => {
    container.remove();
    updateContainerNumbers(containersDiv);
    checkContainers(containersDiv, document.getElementById('defaultMessage'));
  });
}

function addEditTitle(container) {
  const editTitleButton = container.querySelector('.edit-title');
  const titleElement = container.querySelector('.container-title');
  const originalTitle = titleElement.textContent;

  editTitleButton.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'border rounded px-2 py-1 text-sm w-40';
    input.value = titleElement.textContent;

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        titleElement.textContent = input.value;
        input.replaceWith(titleElement);
        editTitleButton.style.display = 'inline-block';
      }
    });

    input.addEventListener('blur', () => {
      titleElement.textContent = input.value || originalTitle;
      input.replaceWith(titleElement);
      editTitleButton.style.display = 'inline-block';
    });

    titleElement.replaceWith(input);
    input.focus();
    editTitleButton.style.display = 'none';
  });
}

function addLoopVideo(container) {
  const loopVideoCheckbox = container.querySelector('.loop-video');
  const videoElement = container.querySelector('video');

  loopVideoCheckbox.addEventListener('change', () => {
    videoElement.loop = loopVideoCheckbox.checked;
  });
}

function toggleStreamButton(container, isStreaming) {
  const startStreamBtn = container.querySelector('.start-stream');
  const stopStreamBtn = container.querySelector('.stop-stream');
  const liveNotif = container.querySelector('.live-notif');

  if (isStreaming) {
    startStreamBtn.classList.add('hidden');
    stopStreamBtn.classList.remove('hidden');
    liveNotif.classList.remove('hidden');
  } else {
    startStreamBtn.classList.remove('hidden');
    stopStreamBtn.classList.add('hidden');
    liveNotif.classList.add('hidden');
  }
}

function addVideoSelector(container) {
  const selectVideoBtn = container.querySelector('.select-video');
  const galleryModal = container.querySelector('.gallery-modal');
  const closeGalleryBtn = container.querySelector('.close-gallery');
  const galleryContainer = container.querySelector('.gallery-container');
  const videoElement = container.querySelector('video');
  const removeVideoBtn = container.querySelector('.remove-video');
  const searchInput = container.querySelector('.search-video');
  let videos = [];

  selectVideoBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/videos-all'); 
      const data = await response.json();
      videos = data.videos || [];
      
      renderVideos(videos);
      galleryModal.classList.replace('hidden', 'flex');
    } catch (error) {
      console.error('Error loading videos:', error);
      Swal.fire('Error', 'Gagal memuat daftar video', 'error');
    }
  });

  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredVideos = videos.filter(video => 
      video.name.toLowerCase().includes(searchTerm)
    );
    renderVideos(filteredVideos);
  });

  function renderVideos(videosToRender) {
    if (!videosToRender || videosToRender.length === 0) {
      galleryContainer.innerHTML = `
        <div class="col-span-full h-[calc(80vh-100px)] flex flex-col items-center justify-center py-10 text-center">
          <div class="bg-gray-100 rounded-full p-4 mb-4">
            <i class="fa-regular fa-folder-open text-4xl text-gray-400"></i>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Tidak ada video</h3>
          <p class="text-sm text-gray-500 mb-4">Upload video terlebih dahulu di halaman Gallery</p>
          <a href="/gallery" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <i class="fa-solid fa-arrow-up-from-bracket mr-2"></i>
            Upload Video
          </a>
        </div>
      `;
    } else {
      galleryContainer.innerHTML = videosToRender.map(video => `
        <div class="video-item cursor-pointer rounded-lg overflow-hidden border hover:border-blue-500 transition-colors"
             data-path="${video.path}" 
             data-name="${video.name}">
          <div class="aspect-video bg-black relative group">
            <img src="/thumbnails/${video.name}" class="w-full h-full object-contain" alt="${video.name}">
            <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <i class="fa-solid fa-check text-2xl text-white"></i>
            </div>
          </div>
          <div class="p-2">
            <p class="text-sm truncate">${video.name}</p>
            <p class="text-xs text-gray-500">Durasi: ${video.duration}</p>
          </div>
        </div>
      `).join('');

      galleryContainer.querySelectorAll('.video-item').forEach(item => {
        item.addEventListener('click', () => {
          const videoPath = item.dataset.path;
          const videoName = item.dataset.name;
          
          videoElement.src = videoPath;
          videoElement.classList.remove('hidden');
          videoElement.controls = true;
          videoElement.volume = 0;
          videoElement.play();

          container.dataset.filePath = videoName;
          selectVideoBtn.classList.add('hidden');
          removeVideoBtn.classList.remove('hidden');
          galleryModal.classList.replace('flex', 'hidden');
          searchInput.value = '';
        });
      });
    }
  }

  closeGalleryBtn.addEventListener('click', () => {
    galleryModal.classList.replace('flex', 'hidden');
  });
}

function addChangeVideo(container) {
  const galleryModal = container.querySelector('.gallery-modal');
  const removeVideoBtn = container.querySelector('.remove-video');
  const videoElement = container.querySelector('video');
  const selectVideoBtn = container.querySelector('.select-video');
  const closeGalleryBtn = container.querySelector('.close-gallery');
  const galleryContainer = container.querySelector('.gallery-container');

  removeVideoBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/videos-all');
      const data = await response.json();

      if (!data.videos || data.videos.length === 0) {
        galleryContainer.innerHTML = `
          <div class="col-span-full h-[calc(80vh-100px)] flex flex-col items-center justify-center py-10 text-center">
            <div class="bg-gray-100 rounded-full p-4 mb-4">
              <i class="fa-regular fa-folder-open text-4xl text-gray-400"></i>
            </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">Tidak ada video</h3>
              <p class="text-sm text-gray-500 mb-4">Upload video terlebih dahulu di halaman Gallery</p>
              <a href="/gallery" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <i class="fa-solid fa-arrow-up-from-bracket mr-2"></i>
                Upload Video
              </a>
          </div>
        `;
      } else {
        galleryContainer.innerHTML = data.videos.map(video => `
          <div class="video-item cursor-pointer rounded-lg overflow-hidden border hover:border-blue-500 transition-colors"
               data-path="${video.path}" 
               data-name="${video.name}">
            <div class="aspect-video bg-black relative group">
              <img src="/thumbnails/${video.name}" class="w-full h-full object-contain" alt="${video.name}">
              <div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-check text-2xl text-white"></i>
              </div>
            </div>
            <div class="p-2">
              <p class="text-sm truncate">${video.name}</p>
              <p class="text-xs text-gray-500">Durasi: ${video.duration}</p>
            </div>
          </div>
        `).join('');

        galleryContainer.querySelectorAll('.video-item').forEach(item => {
          item.addEventListener('click', () => {
            const videoPath = item.dataset.path;
            const videoName = item.dataset.name;
            
            videoElement.src = videoPath;
            videoElement.classList.remove('hidden');
            videoElement.controls = true;
            videoElement.volume = 0;
            videoElement.play();
            
            container.dataset.filePath = videoName;
            selectVideoBtn.classList.add('hidden');
            removeVideoBtn.classList.remove('hidden');
            galleryModal.classList.replace('flex', 'hidden');
          });
        });
      }

      galleryModal.classList.replace('hidden', 'flex');
    } catch (error) {
      console.error('Error loading videos:', error);
      Swal.fire('Error', 'Gagal memuat daftar video', 'error');
    }
  });

  closeGalleryBtn.addEventListener('click', () => {
    galleryModal.classList.replace('flex', 'hidden');
  });
}

function addOrientationToggle(container) {
  const toggleBtn = container.querySelector('.orientation-toggle');
  const landscapeIcon = toggleBtn.querySelector('.icon-landscape');
  const portraitIcon = toggleBtn.querySelector('.icon-portrait');
  
  toggleBtn.addEventListener('click', () => {
    landscapeIcon.classList.toggle('hidden');
    portraitIcon.classList.toggle('hidden');
  });
}

async function loadHistory() {
  const historyTableBody = document.getElementById('historyTableBody');
  const noHistoryMessage = document.getElementById('no-history-message');

  try {
    const response = await fetch('/api/history', { credentials: 'include' });
    if (response.ok) {
      const historyData = await response.json();
      if (historyData.length === 0) {
        noHistoryMessage.classList.remove('hidden');
        historyTableBody.innerHTML = '';
      } else {
        noHistoryMessage.classList.add('hidden');
        historyTableBody.innerHTML = historyData.map((item, index) => `
          <tr>
            <td class="px-4 py-2 border">${index + 1}</td>
            <td class="px-4 py-2 border">
              <div>
                <p class="font-medium">${item.title}</p>
                <p class="text-sm text-gray-500">${item.video_path}</p>
              </div>
            </td>
            <td class="px-4 py-2 border">${item.platform || 'Unknown'}</td>
            <td class="px-4 py-2 border">${new Date(item.created_at).toLocaleString()}</td>
            <td class="px-4 py-2 border">
              <button class="text-red-500 hover:text-red-700 delete-history" data-id="${item.id}">
                Hapus
              </button>
            </td>
          </tr>
        `).join('');

        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-history').forEach(button => {
          button.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            try {
              const deleteResponse = await fetch(`/delete-history/${id}`, {
                method: 'DELETE',
                credentials: 'include',
              });
              if (deleteResponse.ok) {
                Swal.fire('Berhasil', 'Riwayat streaming berhasil dihapus.', 'success');
                loadHistory(); // Reload history after deletion
              } else {
                Swal.fire('Gagal', 'Gagal menghapus riwayat streaming.', 'error');
              }
            } catch (error) {
              console.error('Error deleting history:', error);
              Swal.fire('Error', 'Terjadi kesalahan saat menghapus riwayat.', 'error');
            }
          });
        });
      }
    } else {
      historyTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Gagal memuat riwayat streaming.</td></tr>';
    }
  } catch (error) {
    console.error('Error loading history:', error);
    historyTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Terjadi kesalahan saat memuat riwayat.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const addContainerBtn = document.getElementById('addContainer');
  const containersDiv = document.getElementById('containers');
  const defaultMessage = document.getElementById('defaultMessage');
  const profileMenu = document.getElementById('profileMenu');
  const submenu = document.getElementById('submenu');

  profileMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    submenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#submenu') && !e.target.closest('#profileMenu')) {
      submenu.classList.add('hidden');
    }
  });

  submenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  addContainerBtn.addEventListener('click', () => createContainer({}));

  await loadActiveLives(); // Ensure active lives are loaded on page load

  // Check containers and toggle the default message visibility
  function checkContainers() {
    if (containersDiv.children.length === 0) {
      defaultMessage.classList.remove('hidden');
    } else {
      defaultMessage.classList.add('hidden');
    }
  }

  checkContainers();

  try {
    const response = await fetch('/active-stream-containers', { credentials: 'include' });
    if (response.ok) {
      const containersData = await response.json();
      containersData.forEach(containerData => {
        const enhancedData = {
          ...containerData,
          schedule_enabled: containerData.schedule_enabled || false,
          schedule_duration_enabled: containerData.schedule_duration_enabled || false,
          schedule_duration: containerData.schedule_duration || ''
        };
        createContainer(enhancedData);
      });
    }
    checkContainers(containersDiv, defaultMessage);
  } catch (error) {
    console.error('Error fetching active containers:', error);
  }

  if (window.location.pathname === '/history') {
    loadHistory();
  }
});
