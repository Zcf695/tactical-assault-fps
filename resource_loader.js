// ========== 资源预加载管理器（优化版） ==========
const ResourceLoader = (function() {
    let _isLoading = false;
    let _currentProgress = 0;
    let _currentStatus = '';
    let _onCompleteCallback = null;
    let _loadingTips = [
        '💡 提示：按 K 键打开技能树，升级获得技能点',
        '💡 提示：按 B 键打开背包，拖拽物品到两侧可丢弃',
        '💡 提示：按 F 键搜索容器，高价值物品在保险箱中',
        '💡 提示：按 M 键打开大地图，查看撤离点位置',
        '💡 提示：开镜射击更精准，但移动速度会降低',
        '💡 提示：蹲伏可以减少噪音，适合潜行接近敌人',
        '💡 提示：护甲可以减少伤害，但会增加负重',
        '💡 提示：安全箱中的物品死亡后不会丢失',
        '💡 提示：按 F9 可以测试生成BOSS（仅测试模式）',
        '💡 提示：按 F10/F11/F12 查看任务链/成就/排行榜',
    ];
    let _tipIndex = 0;
    let _tipInterval = null;
    // 缓存预加载的资源，避免重复加载
    let _cachedAudio = {};
    let _cachedImages = {};

    function _updateProgress(percent, status) {
        _currentProgress = Math.min(100, Math.max(0, percent));
        _currentStatus = status || '';
        const fill = document.getElementById('loadingProgressFill');
        const percentEl = document.getElementById('loadingPercent');
        const statusEl = document.getElementById('loadingStatus');
        if (fill) fill.style.width = _currentProgress + '%';
        if (percentEl) percentEl.textContent = Math.floor(_currentProgress) + '%';
        if (statusEl) statusEl.textContent = _currentStatus;
    }

    function _rotateTips() {
        const tipsEl = document.getElementById('loadingTips');
        if (!tipsEl) return;
        _tipIndex = (_tipIndex + 1) % _loadingTips.length;
        tipsEl.innerHTML = '<p>' + _loadingTips[_tipIndex] + '</p>';
    }

    function _startTipRotation() {
        if (_tipInterval) clearInterval(_tipInterval);
        _tipInterval = setInterval(_rotateTips, 3000);
    }

    function _stopTipRotation() {
        if (_tipInterval) {
            clearInterval(_tipInterval);
            _tipInterval = null;
        }
    }

    // 阶段1：检查基础环境（快速）
    function _phase1_checkEnvironment() {
        return new Promise((resolve) => {
            _updateProgress(10, '检查运行环境...');
            // 检查Three.js是否加载
            if (typeof THREE === 'undefined') {
                console.warn('Three.js not loaded');
            }
            resolve();
        });
    }

    // 阶段2：加载地图数据（快速）
    function _phase2_loadMapData() {
        return new Promise((resolve) => {
            _updateProgress(20, '加载地图数据...');
            // 地图数据通过script标签加载，这里检查是否已加载
            if (typeof MAP_DATA === 'undefined') {
                console.warn('MAP_DATA not loaded, using default');
            }
            if (typeof loadMapData === 'function') {
                loadMapData();
            }
            resolve();
        });
    }

    // 阶段3：预加载关键音频资源（只加载2个最常用的）
    function _phase3_preloadAudio() {
        return new Promise((resolve) => {
            _updateProgress(40, '预加载音频资源...');
            // 只预加载最常用的2个音效，减少内存占用
            const audioFiles = [
                '搜索音效/白色蓝色.mp3',
                '搜索音效/紫色.mp3',
            ];
            let loaded = 0;
            const total = audioFiles.length;
            
            audioFiles.forEach((file) => {
                // 如果已经缓存过，直接跳过
                if (_cachedAudio[file]) {
                    loaded++;
                    if (loaded >= total) resolve();
                    return;
                }
                const audio = new Audio();
                audio.preload = 'auto';
                audio.src = file;
                _cachedAudio[file] = audio;
                
                const onComplete = () => {
                    loaded++;
                    if (loaded >= total) resolve();
                };
                
                audio.addEventListener('canplaythrough', onComplete, { once: true });
                audio.addEventListener('error', onComplete, { once: true });
            });
            
            // 超时保护（1.5秒，减少等待时间）
            setTimeout(() => resolve(), 1500);
        });
    }

    // 阶段4：预加载关键UI图标（只加载1个最常用的）
    function _phase4_preloadIcons() {
        return new Promise((resolve) => {
            _updateProgress(60, '预加载UI图标...');
            // 只预加载1个最关键的图标，减少内存占用
            const keyIcons = [
                '装备及药品等杂项/医疗/急救包.png',
            ];
            let loaded = 0;
            const total = keyIcons.length;
            
            keyIcons.forEach((file) => {
                // 如果已经缓存过，直接跳过
                if (_cachedImages[file]) {
                    loaded++;
                    if (loaded >= total) resolve();
                    return;
                }
                const img = new Image();
                img.src = file;
                _cachedImages[file] = img;
                
                const onComplete = () => {
                    loaded++;
                    if (loaded >= total) resolve();
                };
                
                img.onload = onComplete;
                img.onerror = onComplete;
            });
            
            // 超时保护（1秒，减少等待时间）
            setTimeout(() => resolve(), 1000);
        });
    }

    // 阶段5：最终准备（快速）
    function _phase5_finalPreparation() {
        return new Promise((resolve) => {
            _updateProgress(80, '预加载完成，准备初始化...');
            resolve();
        });
    }

    async function startLoading(onComplete) {
        if (_isLoading) return;
        _isLoading = true;
        _onCompleteCallback = onComplete;
        _currentProgress = 0;
        _tipIndex = Math.floor(Math.random() * _loadingTips.length);
        
        // 显示加载界面
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            loadingScreen.style.display = 'flex';
        }
        
        // 开始提示轮播
        _startTipRotation();
        
        try {
            // 按顺序执行各加载阶段（优化后只有5个阶段，减少不必要的等待）
            await _phase1_checkEnvironment();
            await _phase2_loadMapData();
            await _phase3_preloadAudio();
            await _phase4_preloadIcons();
            await _phase5_finalPreparation();
        } catch(e) {
            console.error('Loading error:', e);
            _updateProgress(100, '加载完成（部分资源跳过）');
        }
        
        // 停止提示轮播
        _stopTipRotation();
        
        // 注意：不在这里隐藏加载界面，让onComplete回调自己控制
        // 这样init()函数可以继续更新进度，最后再隐藏加载界面
        _isLoading = false;
        if (typeof _onCompleteCallback === 'function') {
            _onCompleteCallback();
        }
    }

    function hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            // 立即隐藏，不使用setTimeout延迟，避免影响性能
            loadingScreen.style.display = 'none';
        }
        // 清理预加载的音频对象，释放内存
        for (const key in _cachedAudio) {
            if (_cachedAudio[key]) {
                _cachedAudio[key].pause();
                _cachedAudio[key].src = '';
            }
        }
        _cachedAudio = {};
    }

    function showLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('hidden');
            loadingScreen.style.display = 'flex';
        }
    }

    function isLoading() {
        return _isLoading;
    }

    function getProgress() {
        return _currentProgress;
    }

    function getStatus() {
        return _currentStatus;
    }

    // 获取缓存的音频对象（供游戏中使用）
    function getCachedAudio(file) {
        return _cachedAudio[file] || null;
    }

    // 获取缓存的图片对象（供游戏中使用）
    function getCachedImage(file) {
        return _cachedImages[file] || null;
    }

    return {
        startLoading,
        hideLoadingScreen,
        showLoadingScreen,
        isLoading,
        getProgress,
        getStatus,
        getCachedAudio,
        getCachedImage
    };
})();
