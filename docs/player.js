let media="https://cdn.jsdmirror.com/gh/mcyzsx/player@main/media/"




// Cache references to DOM elements.
let elms = ['track','artist', 'timer', 'duration','post', 'playBtn', 'pauseBtn', 'prevBtn', 'nextBtn', 'playlistBtn', 'postBtn', 'waveBtn', 'volumeBtn', 'progress', 'progressBar', 'progressContainer','waveCanvas', 'loading', 'playlist', 'list', 'volume', 'barEmpty', 'barFull', 'sliderBtn'];
elms.forEach(function(elm) {
  window[elm] = document.getElementById(elm);
});

let player;
let playNum=0;
let requestJson="memp.json"
// let requestJson="https://music.meekdai.com/memp.json"

let request=new XMLHttpRequest();
request.open("GET",requestJson);
request.responseType='text';
request.send();
request.onload=function(){
    jsonData=JSON.parse(request.response);
    console.log(jsonData);

    if(window.location.hash!=''){
      try{
          playNum=parseInt(window.location.hash.slice(1));
      }
      catch{
          playNum=jsonData.length-1 //默认最近添加的
      }
  }
  else{playNum=jsonData.length-1} //默认最近添加的

    player = new Player(jsonData);
    
    // 初始化播放模式图标
    if (typeof updatePlayModeIcon === 'function') {
      updatePlayModeIcon();
    }
}

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Player class containing the state of our playlist and where we are in it.
 * Includes all methods for playing, skipping, updating the display, etc.
 * @param {Array} playlist Array of objects with playlist song details ({title, file, howl}).
 */
let Player = function(playlist) {
  this.playlist = playlist;
  this.index = playNum;
  
  // 播放模式：'list' (列表循环), 'one' (单首循环), 'shuffle' (随机循环)
  this.playMode = 'list';
  this.shuffleOrder = []; // 存储随机播放时的顺序

  // Display the title of the first track.
  track.innerHTML =  playlist[this.index].title;
  artist.innerHTML =  playlist[this.index].artist;
  document.querySelector("body").style.backgroundImage = "url('" +media+ encodeURI(playlist[this.index].pic) + "')";
  post.innerHTML = '<p><b>'+playlist[this.index].date+'</b></p>' + playlist[this.index].article;
  document.querySelector('meta[property="og:image"]').setAttribute('content', media+ encodeURI(playlist[this.index].pic));

  // Setup the playlist display.
  playlist.forEach(function(song) {
    let div = document.createElement('div');
    div.className = 'list-song';
    div.id = 'list-song-'+playlist.indexOf(song);
    div.innerHTML = song.title + ' - ' + song.artist;
    div.onclick = function() {
      player.skipTo(playlist.indexOf(song));
    };
    list.appendChild(div);
  });
};
Player.prototype = {
  /**
   * Play a song in the playlist.
   * @param  {Number} index Index of the song in the playlist (leave empty to play the first or current).
   */
  play: function(index) {
    let self = this;
    let sound;

    index = typeof index === 'number' ? index : self.index;
    let data = self.playlist[index];

    // If we already loaded this track, use the current one.
    // Otherwise, setup and load a new Howl.
    if (data.howl) {
      sound = data.howl;
    } else {
      sound = data.howl = new Howl({
        src: [media + data.mp3],
        html5: isMobile(), // Force to HTML5 so that the audio can stream in (best for large files).
        onplay: function() {
          // Display the duration.
          duration.innerHTML = self.formatTime(Math.round(sound.duration()));

          // Start updating the progress of the track.
          requestAnimationFrame(self.step.bind(self));

          // Start the wave animation if we have already loaded
          progressContainer.style.display = 'block';
          pauseBtn.style.display = 'block';
        },
        onload: function() {
          // Start the wave animation.
          progressContainer.style.display = 'block';
          loading.style.display = 'none';
        },
        onend: function() {
          // Stop the wave animation.
          if (self.playMode === 'one') {
            // 单首循环：重新播放当前歌曲
            self.skipTo(self.index);
          } else {
            // 其他模式：播放下一首
            self.skip('next');
          }
        },
        onpause: function() {
          // Stop the wave animation.
          progressContainer.style.display = 'none';
        },
        onstop: function() {
          // Stop the wave animation.
          progressContainer.style.display = 'none';
        },
        onseek: function() {
          // Start updating the progress of the track.
          requestAnimationFrame(self.step.bind(self));
        }
      });
    }

    // Begin playing the sound.
    sound.play();

    // 手机系统控制映射
    if ('mediaSession' in navigator) {
      const artworkUrl = media + encodeURI(data.pic);
      const img = new Image();

      const applyMediaSession = (artwork) => {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: data.title,
          artist: data.artist,
          album: '',
          artwork: artwork ? [artwork] : []
        });
    
        navigator.mediaSession.setActionHandler('play', () => {
          const sound = self.playlist[self.index].howl;
          sound.play();
          navigator.mediaSession.playbackState = 'playing';
          playBtn.style.display = 'none';
          pauseBtn.style.display = 'block';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          const sound = self.playlist[self.index].howl;
          sound.pause();
          navigator.mediaSession.playbackState = 'paused';
          playBtn.style.display = 'block';
          pauseBtn.style.display = 'none';
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => { self.skip('prev'); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { self.skip('next'); });
      };

      //默认无图片
      applyMediaSession(null); 

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const targetSize = 512;
        canvas.width = targetSize;
        canvas.height = targetSize;
    
        // 计算裁剪区域（居中裁剪）
        const sourceSize = Math.min(img.width, img.height);
        const sx = (img.width - sourceSize) / 2;
        const sy = (img.height - sourceSize) / 2;
    
        // 绘制并裁剪图片
        ctx.drawImage(img,sx, sy,sourceSize, sourceSize,0, 0,targetSize, targetSize);

        // 转换为 Data URL（JPEG 格式，质量 90%）
        const croppedUrl = canvas.toDataURL('image/jpeg', 0.9);
    
        // 传递给 MediaSession
        applyMediaSession({src: croppedUrl,sizes: `${targetSize}x${targetSize}`,type: 'image/jpeg'});
      };
    
      img.onerror = (err) => {console.warn("图片加载失败，继续使用无图片：", artworkUrl, err);};

      // 开始加载原图
      img.crossOrigin = 'Anonymous';
      img.src = artworkUrl;
    }

    // Update the track display.
    track.innerHTML = data.title;
    artist.innerHTML =  data.artist;
    post.innerHTML = '<p><b>'+data.date+'</b></p>'+data.article;
    document.title=data.title + " - Gmemp";//显示浏览器TAB栏内容
    document.querySelector("body").style.backgroundImage = "url('" +media+ encodeURI(data.pic) + "')";
    window.location.hash="#"+(index);

    document.querySelector('meta[property="og:title"]').setAttribute('content', data.title);
    document.querySelector('meta[property="og:description"]').setAttribute('content', data.article);
    document.querySelector('meta[property="og:url"]').setAttribute('content', window.location.href);
    document.querySelector('meta[property="og:image"]').setAttribute('content', media+ encodeURI(data.pic));

    document.querySelector('#list-song-'+playNum).style.backgroundColor='';//清除上一首选中
    document.querySelector('#list-song-'+index).style.backgroundColor='rgba(255, 255, 255, 0.1)';//高亮当前播放
    playNum=index;
    
    //https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API
    this.analyser=Howler.ctx.createAnalyser();
    this.analyser.fftSize = Math.pow(2, Math.floor(Math.log2((window.innerWidth / 15) * 2)));
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(this.bufferLength);
    Howler.masterGain.connect(this.analyser);
    draw();

    // Show the pause button.
    if (sound.state() === 'loaded') {
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'block';
    } else {
      loading.style.display = 'block';
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
    }

    // Keep track of the index we are currently playing.
    self.index = index;
  },

  //暂停
  pause: function() {
    let self = this;

    // Get the Howl we want to manipulate.
    let sound = self.playlist[self.index].howl;

    // Puase the sound.
    sound.pause();

    // Show the play button.
    playBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
  },

  //切换播放模式
  togglePlayMode: function() {
    const modes = ['list', 'one', 'shuffle'];
    let currentIndex = modes.indexOf(this.playMode);
    let nextIndex = (currentIndex + 1) % modes.length;
    this.playMode = modes[nextIndex];
    
    // 如果切换到随机模式，生成随机顺序
    if (this.playMode === 'shuffle') {
      this.generateShuffleOrder();
    }
    
    console.log("当前播放模式:", this.getPlayModeName());
    return this.playMode;
  },
  
  //获取播放模式名称
  getPlayModeName: function() {
    const names = {
      'list': '列表循环',
      'one': '单首循环',
      'shuffle': '随机播放'
    };
    return names[this.playMode] || '未知模式';
  },
  
  //生成随机播放顺序
  generateShuffleOrder: function() {
    this.shuffleOrder = [];
    let indices = [];
    for (let i = 0; i < this.playlist.length; i++) {
      indices.push(i);
    }
    
    // Fisher-Yates 洗牌算法
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    this.shuffleOrder = indices;
  },
  
  //获取随机模式下的下一首索引
  getNextShuffleIndex: function() {
    if (this.shuffleOrder.length === 0) {
      this.generateShuffleOrder();
    }
    
    let currentPos = this.shuffleOrder.indexOf(this.index);
    let nextPos = (currentPos + 1) % this.shuffleOrder.length;
    return this.shuffleOrder[nextPos];
  },

  /**
   * Skip to the next or previous track.
   * @param  {String} direction 'next' or 'prev'.
   */
  skip: function(direction) {
    let self = this;
    let index = 0;

    // 根据播放模式决定下一首
    if (self.playMode === 'one') {
      // 单首循环：跳过当前歌曲（实际上是重播）
      if (direction === 'next') {
        // 播放下一首（列表循环）
        index = self.index - 1;
        if (index < 0) {
          index = self.playlist.length - 1;
        }
      } else {
        // 播放上一首
        index = self.index + 1;
        if (index >= self.playlist.length) {
          index = 0;
        }
      }
      // 切换到列表循环模式（用户体验考虑）
      self.playMode = 'list';
    } else if (self.playMode === 'shuffle') {
      // 随机播放
      index = self.getNextShuffleIndex();
    } else {
      // 列表循环（默认）
      if (direction === 'next') {
        index = self.index - 1;
        if (index < 0) {
          index = self.playlist.length - 1;
        }
      } else {
        index = self.index + 1;
        if (index >= self.playlist.length) {
          index = 0;
        }
      }
    }

    self.skipTo(index);
  },

  /**
   * Skip to a specific track based on its playlist index.
   * @param  {Number} index Index in the playlist.
   */
  skipTo: function(index) {
    let self = this;

    // Stop the current track.
    if (self.playlist[self.index].howl) {
      self.playlist[self.index].howl.stop();
    }

    // Reset progress.
    progress.style.width = '0%';

    // Play the new track.
    self.play(index);
  },

  /**
   * Set the volume and update the volume slider display.
   * @param  {Number} val Volume between 0 and 1.
   */
  volume: function(val) {
    let self = this;

    // Update the global volume (affecting all Howls).
    Howler.volume(val);

    // Update the display on the slider.
    let barWidth = (val * 90) / 100;
    barFull.style.width = (barWidth * 100) + '%';
    sliderBtn.style.left = (window.innerWidth * barWidth + window.innerWidth * 0.05 - 25) + 'px';
  },

  /**
   * Seek to a new position in the currently playing track.
   * @param  {Number} per Percentage through the song to skip.
   */
  seek: function(per) {
    let self = this;

    // Get the Howl we want to manipulate.
    let sound = self.playlist[self.index].howl;

    // Convert the percent into a seek position.
    if (sound.playing()) {
      sound.seek(sound.duration() * per);
    }
  },

  /**
   * The step called within requestAnimationFrame to update the playback position.
   */
  step: function() {
    let self = this;

    // Get the Howl we want to manipulate.
    let sound = self.playlist[self.index].howl;

    // Determine our current seek position.
    let seek = sound.seek() || 0;
    timer.innerHTML = self.formatTime(Math.round(seek));
    progress.style.width = (((seek / sound.duration()) * 100) || 0) + '%';

    // If the sound is still playing, continue stepping.
    if (sound.playing()) {
      requestAnimationFrame(self.step.bind(self));
    }
  },

  //是否显示歌曲列表
  togglePlaylist: function() {
    let self = this;
    let display = (playlist.style.display === 'block') ? 'none' : 'block';

    setTimeout(function() {
      playlist.style.display = display;
      if (playlist.style.display=='block'){ //滚动到当前播放歌曲的位置
        let [parentDoc,childDoc]= [list,document.querySelector('#list-song-'+playNum)];
        parentDoc.scrollTop = childDoc.offsetTop - parentDoc.offsetHeight /2 ;
      }

    }, (display === 'block') ? 0 : 500);
    playlist.className = (display === 'block') ? 'fadein' : 'fadeout';
  },

  //是否显示文章
  togglePost: function() {
    if(post.style.display=="none"){post.style.display="block";}
    else{post.style.display="none";}
  },

  //是否显示频率
  toggleWave: function() {
    if(waveCanvas.style.display=="none"){waveCanvas.style.display="block";}
    else{waveCanvas.style.display="none";}
  },

  //是否显示音量调节界面
  toggleVolume: function() {
    let self = this;
    let display = (volume.style.display === 'block') ? 'none' : 'block';

    setTimeout(function() {
      volume.style.display = display;
    }, (display === 'block') ? 0 : 500);
    volume.className = (display === 'block') ? 'fadein' : 'fadeout';
  },

  //格式化时间为 M:SS.
  formatTime: function(secs) {
    let minutes = Math.floor(secs / 60) || 0;
    let seconds = (secs - minutes * 60) || 0;
    return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }
};

// Bind our player controls.
playBtn.addEventListener('click', function() {
  player.play();
});
pauseBtn.addEventListener('click', function() {
  player.pause();
});
prevBtn.addEventListener('click', function() {
  player.skip('prev');
});
nextBtn.addEventListener('click', function() {
  player.skip('next');
});

// 播放模式按钮事件
playModeBtn.addEventListener('click', function() {
  player.togglePlayMode();
  updatePlayModeIcon();
});

// 更新播放模式图标
function updatePlayModeIcon() {
  const icons = {
    'list': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23fff' d='M0 128C0 92.7 28.7 64 64 64H448c35.3 0 64 28.7 64 64V384c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128zm64 32v64c0 17.7 14.3 32 32 32H352c17.7 0 32-14.3 32-32V160c0-17.7-14.3-32-32-32H96c-17.7 0-32 14.3-32 32zM80 320c-13.3 0-24 10.7-24 24s10.7 24 24 24h64c13.3 0 24-10.7 24-24s-10.7-24-24-24H80zm136 0c-13.3 0-24 10.7-24 24s10.7 24 24 24h64c13.3 0 24-10.7 24-24s-10.7-24-24-24H216z'/%3E%3C/svg%3E",
    'one': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23fff' d='M232 192V336c0 14.3 7.8 27.9 19.7 35.1l10.6 6.6c12.4 7.8 28.1 7.8 40.5-.2L447 371.4c13.2 8.3 21.2 22.6 21.2 38.6c0 26.5-21.5 48-48 48H144c-26.5 0-48-21.5-48-48V240c0-26.5 21.5-48 48-48h208c4.4 0 8.7 2.2 11.3 6.1l6.5 9.7c3.4 5.3 10.5 7.6 15.9 5.1l29.2-13.6c12.6-5.9 27.8-4.2 37.9 4.2c11.7 9.7 13.2 26.9 3.4 38.4L343.6 292c-8.4 9.8-8.4 24.3 0 34.1l26.5 21.4c9.1 7.3 21.5 6.9 30.2-1.1c9.8-9 11.6-23.7 4.2-35.2l-21.4-33.6c-10-15.5-30.8-20.3-45.8-10.5l-29.2 19.1c-6.1 4-13.2 6.1-20.4 6.1H80c-13.3 0-24-10.7-24-24s10.7-24 24-24H232zM48 240v224c0 13.3 10.7 24 24 24H416c13.3 0 24-10.7 24-24V240c0-13.3-10.7-24-24-24H72c-13.3 0-24 10.7-24 24z'/%3E%3C/svg%3E",
    'shuffle': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23fff' d='M40 48C26.7 48 16 58.7 16 72v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V72c0-13.3-10.7-24-24-24H40zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM16 232v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H40c-13.3 0-24 10.7-24 24zM40 368c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V392c0-13.3-10.7-24-24-24H40z'/%3E%3C/svg%3E"
  };
  
  playModeBtn.style.backgroundImage = 'url("' + icons[player.playMode] + '")';
  playModeBtn.title = '当前: ' + player.getPlayModeName() + ' (点击切换)';
}
progressContainer.addEventListener('click', function(event) {
  let rect = progressBar.getBoundingClientRect();
  let per = (event.clientX - rect.left) / rect.width;
  per = Math.min(1, Math.max(0, per));
  player.seek(per);
});

// 进度条拖动功能
let progressDrag = false;

progressContainer.addEventListener('mousedown', function(event) {
  progressDrag = true;
  let rect = progressBar.getBoundingClientRect();
  let per = (event.clientX - rect.left) / rect.width;
  player.seek(per);
});

progressContainer.addEventListener('touchstart', function(event) {
  progressDrag = true;
  let rect = progressBar.getBoundingClientRect();
  let per = (event.touches[0].clientX - rect.left) / rect.width;
  player.seek(per);
});

progressContainer.addEventListener('mousemove', function(event) {
  if (progressDrag) {
    let rect = progressBar.getBoundingClientRect();
    let per = (event.clientX - rect.left) / rect.width;
    per = Math.min(1, Math.max(0, per));
    progress.style.width = (per * 100) + '%';
  }
});

progressContainer.addEventListener('touchmove', function(event) {
  if (progressDrag) {
    event.preventDefault();
    let rect = progressBar.getBoundingClientRect();
    let per = (event.touches[0].clientX - rect.left) / rect.width;
    per = Math.min(1, Math.max(0, per));
    progress.style.width = (per * 100) + '%';
  }
});

document.addEventListener('mouseup', function() {
  progressDrag = false;
});

document.addEventListener('touchend', function() {
  progressDrag = false;
});
playlistBtn.addEventListener('click', function() {
  player.togglePlaylist();
});
playlist.addEventListener('click', function() {
  player.togglePlaylist();
});
postBtn.addEventListener('click', function() {
  player.togglePost();
});
waveBtn.addEventListener('click', function() {
  player.toggleWave();
});
volumeBtn.addEventListener('click', function() {
  player.toggleVolume();
});
volume.addEventListener('click', function() {
  player.toggleVolume();
});

// Setup the event listeners to enable dragging of volume slider.
barEmpty.addEventListener('click', function(event) {
  let per = event.layerX / parseFloat(barEmpty.scrollWidth);
  player.volume(per);
});
sliderBtn.addEventListener('mousedown', function() {
  window.sliderDown = true;
});
sliderBtn.addEventListener('touchstart', function() {
  window.sliderDown = true;
});
volume.addEventListener('mouseup', function() {
  window.sliderDown = false;
});
volume.addEventListener('touchend', function() {
  window.sliderDown = false;
});

let move = function(event) {
  if (window.sliderDown) {
    let x = event.clientX || event.touches[0].clientX;
    let startX = window.innerWidth * 0.05;
    let layerX = x - startX;
    let per = Math.min(1, Math.max(0, layerX / parseFloat(barEmpty.scrollWidth)));
    player.volume(per);
  }
};

volume.addEventListener('mousemove', move);
volume.addEventListener('touchmove', move);

let canvasCtx=waveCanvas.getContext("2d");

function draw() {
  let HEIGHT = window.innerHeight;
  let WIDTH = window.innerWidth;
  waveCanvas.setAttribute('width', WIDTH);
  waveCanvas.setAttribute('height', HEIGHT);

  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
  drawVisual = requestAnimationFrame(draw);

  player.analyser.getByteFrequencyData(player.dataArray);

  canvasCtx.fillStyle = "rgba(0,0,0,0)";
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

  const barWidth = (WIDTH / player.bufferLength);
  let barHeight;
  let x = 0;

  for (let i = 0; i < player.bufferLength; i++) {
    barHeight = player.dataArray[i];

    // canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
    canvasCtx.fillStyle = 'rgba(255,255,255,0.5)';
    canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight/2);

    x += barWidth + 1;
  }
}


document.addEventListener('keyup', function(event) {
  console.log(event.key);
  if (event.key == ' ' || event.key == "MediaPlayPause"){
    if(pauseBtn.style.display == 'none' || pauseBtn.style.display=="") {player.play();}
    else {player.pause();}
  }
  else if(event.key == "MediaTrackNext"){player.skip('next');}
  else if(event.key == "MediaTrackPrevious"){player.skip('prev');}
  else if(event.key == "l"|| event.key === "L"){player.togglePlaylist();}
  else if(event.key == "p"|| event.key === "P"){player.togglePost();}
  else if(event.key == "w"|| event.key === "W"){player.toggleWave();}
  else if(event.key == "v"|| event.key === "V"){player.toggleVolume();}
  else if(event.key == "m"|| event.key === "M"){
    player.togglePlayMode();
    updatePlayModeIcon();
  }
});

console.log("\n %c Gmemp v3.4.8 %c https://github.com/Meekdai/Gmemp \n", "color: #fff; background-image: linear-gradient(90deg, rgb(47, 172, 178) 0%, rgb(45, 190, 96) 100%); padding:5px 1px;", "background-image: linear-gradient(90deg, rgb(45, 190, 96) 0%, rgb(255, 255, 255) 100%); padding:5px 0;");