const video = document.getElementById('video');
const canvas = document.getElementById('result-canvas');
const ctx = canvas.getContext('2d');
const countdownEl = document.getElementById('countdown');
const poseSlotsContainer = document.getElementById('pose-slots');
const nextBtn = document.getElementById('next-to-edit');

let currentLayout = 1;
let capturedImages = [];
let stickers = []; 
let isDragging = false;
let selectedStickerIndex = null;

// FUNGSI NAVIGASI
function showPage(id) {
    document.querySelectorAll('section').forEach(s => {
        s.classList.add('hidden');
        s.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) {
        target.classList.remove('hidden');
        target.style.display = 'flex';
    }
}

function goBack(n) { showPage('page-' + n); }

// INISIALISASI SLOT FOTO
function initPoseSlots() {
    poseSlotsContainer.innerHTML = '';
    capturedImages = new Array(currentLayout).fill(null);
    nextBtn.classList.add('hidden');
    nextBtn.style.display = 'none';

    for (let i = 0; i < currentLayout; i++) {
        const slot = document.createElement('div');
        slot.className = "relative aspect-[3/2] bg-[#F4F4F2] rounded border-[1px] border-[#D1D1CB] overflow-hidden";
        slot.id = `slot-${i}`;
        slot.innerHTML = `<p class="absolute inset-0 flex items-center justify-center text-[8px] text-[#A7A399] tracking-widest uppercase">Pose ${i+1}</p>`;
        poseSlotsContainer.appendChild(slot);
    }
}

async function selectLayout(n) {
    currentLayout = n;
    initPoseSlots();
    showPage('page-2');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, aspectRatio: 1.5 } 
        });
        video.srcObject = stream;
    } catch (err) { alert("Camera access denied."); }
}

function toggleMirror() { video.classList.toggle('mirror'); }

// LOGIKA CAPTURE
document.getElementById('capture-btn').onclick = async () => {
    const emptyIdx = capturedImages.findIndex(img => img === null);
    if (emptyIdx === -1) return;

    countdownEl.classList.remove('hidden');
    countdownEl.style.display = 'flex';
    for (let i = 3; i > 0; i--) {
        countdownEl.innerText = i;
        await new Promise(r => setTimeout(r, 1000));
    }
    countdownEl.classList.add('hidden');
    countdownEl.style.display = 'none';

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1200; tempCanvas.height = 800;
    const tCtx = tempCanvas.getContext('2d');

    if (video.classList.contains('mirror')) {
        tCtx.translate(tempCanvas.width, 0);
        tCtx.scale(-1, 1);
    }

    const vW = video.videoWidth, vH = video.videoHeight;
    const vRatio = vW / vH, tRatio = 1.5;
    let sx, sy, sW, sH;
    if (vRatio > tRatio) { sH = vH; sW = vH * tRatio; sx = (vW - sW) / 2; sy = 0; }
    else { sW = vW; sH = vW / tRatio; sx = 0; sy = (vH - sH) / 2; }

    tCtx.drawImage(video, sx, sy, sW, sH, 0, 0, 1200, 800);
    capturedImages[emptyIdx] = tempCanvas.toDataURL('image/png');
    updateSlotUI(emptyIdx);
};

function updateSlotUI(idx) {
    const slot = document.getElementById(`slot-${idx}`);
    slot.innerHTML = `
        <img src="${capturedImages[idx]}" class="w-full h-full object-cover">
        <button onclick="retake(${idx})" class="absolute top-1 right-1 bg-black text-white px-2 py-1 rounded text-[7px] font-bold tracking-tighter uppercase z-10">Retake</button>
    `;

    const isAllFilled = capturedImages.every(img => img !== null);
    if (isAllFilled) {
        nextBtn.classList.remove('hidden');
        nextBtn.style.display = 'block';
    }
}

function retake(idx) {
    capturedImages[idx] = null;
    const slot = document.getElementById(`slot-${idx}`);
    slot.innerHTML = `<p class="absolute inset-0 flex items-center justify-center text-[8px] text-[#A7A399] tracking-widest uppercase">Pose ${idx+1}</p>`;
    nextBtn.classList.add('hidden');
    nextBtn.style.display = 'none';
}

// LOGIKA TOMBOL PROCEED TO EDIT (PERBAIKAN)
nextBtn.addEventListener('click', () => {
    showPage('page-3');
    renderFinal();
});

function renderFinal() {
    canvas.width = 800;
    canvas.height = (800 / 1.5 * currentLayout) + 160;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const pad = 40, gap = 15, imgW = 720, imgH = 480;
    let loaded = 0;
    
    capturedImages.forEach((src, i) => {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, pad, pad + (i * (imgH + gap)), imgW, imgH);
            if (++loaded === currentLayout) drawOrnaments();
        };
        img.src = src;
    });
}

// TEXT & STICKERS
function addSticker(emoji) {
    stickers.push({ type: 'emoji', content: emoji, x: 400, y: 300, size: 80 });
    renderFinal();
}

function addText() {
    const input = document.getElementById('text-input');
    const fontValue = document.getElementById('font-select').value;
    if (!input.value.trim()) return;

    const fontMap = {
        'Inter': 'bold 40px Inter',
        'Serif': 'italic 45px "Playfair Display"',
        'Cursive': '50px "Dancing Script"',
        'Monospace': '35px "Courier Prime"'
    };

    stickers.push({
        type: 'text', content: input.value.toUpperCase(), font: fontMap[fontValue], x: 400, y: 400
    });
    input.value = '';
    renderFinal();
}

function clearOrnaments() {
    stickers = [];
    renderFinal();
}

function drawOrnaments() {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#333331";
    stickers.forEach(s => {
        if (s.type === 'text') {
            ctx.font = s.font; ctx.fillText(s.content, s.x, s.y);
        } else {
            ctx.font = `${s.size}px serif`; ctx.fillText(s.content, s.x, s.y);
        }
    });
}

// DRAG LOGIC (Pointer Pos & Events)
function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

const handleStart = (e) => {
    const pos = getPointerPos(e);
    for (let i = stickers.length - 1; i >= 0; i--) {
        const s = stickers[i];
        const hitArea = s.type === 'text' ? 120 : 60;
        if (Math.hypot(s.x - pos.x, s.y - pos.y) < hitArea) {
            selectedStickerIndex = i; isDragging = true;
            const picked = stickers.splice(i, 1)[0];
            stickers.push(picked);
            selectedStickerIndex = stickers.length - 1;
            break;
        }
    }
};

const handleMove = (e) => {
    if (isDragging && selectedStickerIndex !== null) {
        if (e.cancelable) e.preventDefault();
        const pos = getPointerPos(e);
        stickers[selectedStickerIndex].x = pos.x;
        stickers[selectedStickerIndex].y = pos.y;
        renderFinal();
    }
};

const handleEnd = () => { isDragging = false; selectedStickerIndex = null; };

canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
canvas.addEventListener('touchstart', handleStart, { passive: false });
window.addEventListener('touchmove', handleMove, { passive: false });
window.addEventListener('touchend', handleEnd, { passive: false });

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'studio-capsule-shot.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}