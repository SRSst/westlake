document.addEventListener('DOMContentLoaded', function () {

    /* =======================================================
       一、页面淡入
       ======================================================= */
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity .5s ease';
    requestAnimationFrame(() => { document.body.style.opacity = '1'; });

    /* =======================================================
       二、预览卡片 — 点击切换
       ======================================================= */
    let activeCard = null;          // 当前打开的景点 id
    const markers = document.querySelectorAll('.scene-marker');

    markers.forEach(marker => {
        const dot = marker.querySelector('.marker-dot');
        if (!dot) return;

        dot.addEventListener('click', function (e) {
            e.stopPropagation();
            // 如果正在拖拽则忽略
            if (hasDragged) return;

            const sceneId = marker.dataset.scene;
            const card = document.getElementById('card-' + sceneId);
            if (!card) return;

            // 同一个 → 关闭
            if (activeCard === sceneId) {
                closeAllCards();
                return;
            }

            // 关闭之前的，打开新的
            closeAllCards();
            card.classList.add('visible');
            marker.classList.add('card-open');
            activeCard = sceneId;
        });
    });

    function closeAllCards() {
        document.querySelectorAll('.preview-card.visible').forEach(c => {
            c.classList.remove('visible');
        });
        document.querySelectorAll('.scene-marker.card-open').forEach(m => {
            m.classList.remove('card-open');
        });
        activeCard = null;
    }

    // 点击空白区域关闭卡片
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.scene-marker') && !e.target.closest('.preview-card')) {
            closeAllCards();
        }
    });

    /* =======================================================
       三、地图缩放 + 拖拽
       ======================================================= */
    const viewport  = document.getElementById('mapViewport');
    const zoomable  = document.getElementById('mapZoomable');
    const levelSpan = document.getElementById('zoomLevel');

    if (!viewport || !zoomable) return;     // 详情页没有地图

    let scale      = 1;
    let translateX = 0;
    let translateY = 0;
    const MIN_S = 1, MAX_S = 4;

    // —— 更新 DOM ——
    function applyTransform(smooth) {
        zoomable.style.transition = smooth ? 'transform .3s ease' : 'none';
        zoomable.style.transform =
            `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        if (levelSpan) levelSpan.textContent = Math.round(scale * 100) + '%';
    }

    function clampTranslate() {
        if (scale <= 1) {
            translateX = 0;
            translateY = 0;
            return;
        }
        const rect = viewport.getBoundingClientRect();
        const maxTx = 0;
        const minTx = rect.width  - rect.width  * scale;
        const maxTy = 0;
        const minTy = rect.height - rect.height * scale;
        translateX = Math.min(maxTx, Math.max(minTx, translateX));
        translateY = Math.min(maxTy, Math.max(minTy, translateY));
    }

    // —— 滚轮缩放（以鼠标位置为中心）——
    viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        const newScale = Math.min(MAX_S, Math.max(MIN_S, scale + delta));
        if (newScale === scale) return;

        const rect = viewport.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const ratio = newScale / scale;
        translateX = mx - ratio * (mx - translateX);
        translateY = my - ratio * (my - translateY);
        scale = newScale;

        clampTranslate();
        applyTransform(false);
    }, { passive: false });

    // —— 鼠标拖拽平移 ——
    let isDragging = false;
    let hasDragged = false;
    let dragStartX = 0, dragStartY = 0;

    viewport.addEventListener('mousedown', function (e) {
        // 如果点在标记点/卡片上则不拖拽
        if (e.target.closest('.marker-dot') || e.target.closest('.preview-card')) return;
        isDragging = true;
        hasDragged = false;
        dragStartX = e.clientX - translateX;
        dragStartY = e.clientY - translateY;
        viewport.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX - translateX;
        const dy = e.clientY - dragStartY - translateY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
        translateX = e.clientX - dragStartX;
        translateY = e.clientY - dragStartY;
        clampTranslate();
        applyTransform(false);
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            viewport.style.cursor = 'grab';
        }
        // 延迟重置 hasDragged，保证 click 事件可读到
        setTimeout(() => { hasDragged = false; }, 50);
    });

    // —— 按钮缩放 ——
    const btnIn    = document.getElementById('zoomIn');
    const btnOut   = document.getElementById('zoomOut');
    const btnReset = document.getElementById('zoomReset');

    if (btnIn) btnIn.addEventListener('click', function () {
        const rect = viewport.getBoundingClientRect();
        const cx = rect.width / 2, cy = rect.height / 2;
        const newScale = Math.min(MAX_S, scale + 0.3);
        const ratio = newScale / scale;
        translateX = cx - ratio * (cx - translateX);
        translateY = cy - ratio * (cy - translateY);
        scale = newScale;
        clampTranslate();
        applyTransform(true);
    });

    if (btnOut) btnOut.addEventListener('click', function () {
        const rect = viewport.getBoundingClientRect();
        const cx = rect.width / 2, cy = rect.height / 2;
        const newScale = Math.max(MIN_S, scale - 0.3);
        const ratio = newScale / scale;
        translateX = cx - ratio * (cx - translateX);
        translateY = cy - ratio * (cy - translateY);
        scale = newScale;
        clampTranslate();
        applyTransform(true);
    });

    if (btnReset) btnReset.addEventListener('click', function () {
        scale = 1;
        translateX = 0;
        translateY = 0;
        applyTransform(true);
    });

    // —— 触摸支持（移动端）——
    let lastTouchDist = 0;
    let touchStartX = 0, touchStartY = 0;

    viewport.addEventListener('touchstart', function (e) {
        if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        } else if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX - translateX;
            touchStartY = e.touches[0].clientY - translateY;
        }
    }, { passive: true });

    viewport.addEventListener('touchmove', function (e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = (dist - lastTouchDist) * 0.008;
            scale = Math.min(MAX_S, Math.max(MIN_S, scale + delta));
            lastTouchDist = dist;
            clampTranslate();
            applyTransform(false);
        } else if (e.touches.length === 1 && scale > 1) {
            e.preventDefault();
            translateX = e.touches[0].clientX - touchStartX;
            translateY = e.touches[0].clientY - touchStartY;
            clampTranslate();
            applyTransform(false);
        }
    }, { passive: false });

    /* =======================================================
       四、标记点依次出现
       ======================================================= */
    markers.forEach((m, i) => {
        m.style.opacity = '0';
        setTimeout(() => {
            m.style.transition = 'opacity .45s ease';
            m.style.opacity = '1';
        }, 200 + i * 80);
    });

});
