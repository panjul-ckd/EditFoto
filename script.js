let photos = [];
let uploadQueue = [];
let isProcessing = false;
let currentMode = 'cetak';

const sizes = { 
    '2x3': {w: 21, h: 30}, '3x4': {w: 28, h: 38}, '4x6': {w: 38, h: 56}, 
    '4R': {w: 102, h: 152}, '8R': {w: 203, h: 254} 
};

// --- NAVIGASI ---
function switchMode(mode) {
    currentMode = mode;
    document.getElementById('btn-mode-cetak').className = mode === 'cetak' ? 'nav-link active' : 'nav-link';
    document.getElementById('btn-mode-bg').className = mode === 'bg-remover' ? 'nav-link active' : 'nav-link';
    
    document.getElementById('control-cetak').classList.toggle('hidden', mode === 'bg-remover');
    document.getElementById('paper-view').classList.toggle('hidden', mode === 'bg-remover');
    document.getElementById('bg-welcome').classList.toggle('hidden', mode === 'cetak');
    document.getElementById('main-download-btn').classList.toggle('hidden', mode === 'bg-remover');
    
    renderPhotoList(); 
    updatePreview();
}

function updateProgress(val) {
    document.getElementById('progress-fill').style.width = val + '%';
    document.getElementById('percent-val').innerText = Math.floor(val) + '%';
}

// --- KONVERSI BLOB KE BASE64 (Kunci Stabilitas) ---
function blobToBase64(blob) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

// --- PROSES UPLOAD ---
async function handleUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Langsung munculkan loading
    document.getElementById('loading').style.display = 'block';
    uploadQueue.push(...files);
    if (!isProcessing) processQueue();
}

async function processQueue() {
    if (uploadQueue.length === 0) { 
        isProcessing = false; 
        setTimeout(() => {
            document.getElementById('loading').style.display='none';
            updateProgress(0);
        }, 800); 
        return; 
    }
    
    isProcessing = true;
    const file = uploadQueue.shift();
    document.getElementById('status-msg').innerText = "AI Memproses...";
    
    try {
        updateProgress(10);
        
        // 1. Kecilkan gambar dulu agar AI tidak crash
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise(r => img.onload = r);
        
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 800 / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const compressedBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
        updateProgress(30);

        // 2. Jalankan AI Hapus BG
        const bgRemovedBlob = await imglyRemoveBackground(compressedBlob);
        updateProgress(70);

        // 3. Simpan SEBAGAI BASE64 (Teks) bukan ObjectURL
        const noBgBase64 = await blobToBase64(bgRemovedBlob);
        const originalBase64 = await blobToBase64(compressedBlob);
        
        photos.push({ 
            original: originalBase64, 
            noBg: noBgBase64, 
            current: originalBase64, 
            qty: 1, 
            offset: 50 
        });

        updateProgress(100);
        renderPhotoList(); 
        updatePreview();
        
        // Lanjut antrean berikutnya
        setTimeout(processQueue, 300);
        
    } catch (e) {
        console.error("Error:", e);
        processQueue();
    }
}

// --- GANTI WARNA ---
async function changeBg(index, color) {
    const p = photos[index];
    if (color === 'original') {
        p.current = p.original;
    } else {
        const canvas = document.getElementById('tempCanvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = p.noBg;
        await new Promise(r => img.onload = r);
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        p.current = canvas.toDataURL('image/png');
    }
    renderPhotoList();
    updatePreview();
}

// --- RENDER LIST ---
function renderPhotoList() {
    const container = document.getElementById('photoListContainer');
    container.innerHTML = '';
    const sizeVal = document.getElementById('size').value;
    const sz = sizes[sizeVal];
    const boxH = (sz.h / sz.w) * 70;
    
    photos.forEach((p, i) => {
        const isBg = currentMode === 'bg-remover';
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center;">
                <div style="width:70px; height:${boxH}px; border:2.5px solid #2563eb; border-radius:8px; background:url('${p.current}') center ${p.offset}% / cover no-repeat;"></div>
                <div style="flex:1">
                    <input type="range" style="width:100%" min="0" max="100" value="${p.offset}" oninput="photos[${i}].offset=this.value; updatePreview(); renderPhotoList()">
                    <div style="display:flex; gap:5px; margin-top:5px">
                        ${!isBg ? `<input type="number" value="${p.qty}" onchange="photos[${i}].qty=parseInt(this.value); updatePreview()" style="width:45px; border:1px solid #ddd; border-radius:4px;">` : ''}
                        <button onclick="downloadManualCrop(${i})" style="flex:1; background:#059669; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold;">💾 SIMPAN</button>
                        <button onclick="photos.splice(${i},1); renderPhotoList(); updatePreview()" style="background:#ef4444; color:white; border:none; padding:8px; border-radius:6px;">🗑️</button>
                    </div>
                </div>
            </div>
            <div class="color-grid">
                <div class="color-box" style="background:#ddd" onclick="changeBg(${i}, 'original')"></div>
                <div class="color-box" style="background:red" onclick="changeBg(${i}, '#ff0000')"></div>
                <div class="color-box" style="background:blue" onclick="changeBg(${i}, '#0000ff')"></div>
                <div class="color-box" style="background:white" onclick="changeBg(${i}, '#ffffff')"></div>
                <div class="color-box" style="background:linear-gradient(45deg,red,blue); position:relative; overflow:hidden;">
                    <input type="color" onchange="changeBg(${i}, this.value)" style="position:absolute; opacity:0; width:100%; height:100%; cursor:pointer;">
                </div>
            </div>`;
        container.appendChild(div);
    });
}

// --- UPDATE PREVIEW ---
function updatePreview() {
    const paper = document.getElementById('paper');
    if (!paper || currentMode === 'bg-remover') return;
    paper.innerHTML = '';
    const sz = sizes[document.getElementById('size').value];
    const scale = paper.offsetWidth / 210;
    let x = 5, y = 5;
    
    photos.forEach(p => {
        for(let i=0; i<p.qty; i++) {
            const w = sz.w * scale, h = sz.h * scale;
            if (x + w > paper.offsetWidth - 5) { x = 5; y += h + 1; }
            if (y + h > paper.offsetHeight - 5) break;
            const div = document.createElement('div');
            div.className = 'preview-photo';
            Object.assign(div.style, { 
                width: w+'px', height: h+'px', left: x+'px', top: y+'px', 
                backgroundImage: `url(${p.current})`, 
                backgroundPosition: `center ${p.offset}%` 
            });
            paper.appendChild(div); 
            x += w + 1;
        }
    });
}

// --- PDF & CROP ---
function getCleanCrop(ctx, img, canvas, offset) {
    const iR = img.width / img.height; const cR = canvas.width / canvas.height;
    let dW, dH, dX, dY;
    if (iR > cR) { dH = img.height; dW = img.height * cR; dX = (img.width - dW) / 2; dY = 0; }
    else { dW = img.width; dH = img.width / cR; dX = 0; dY = (img.height - dH) * (offset / 100); }
    ctx.drawImage(img, dX, dY, dW, dH, 0, 0, canvas.width, canvas.height);
}

async function downloadManualCrop(i) {
    const canvas = document.getElementById('tempCanvas'); const ctx = canvas.getContext('2d');
    const p = photos[i]; const sz = sizes[document.getElementById('size').value];
    const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
    canvas.width = 1200; canvas.height = (sz.h/sz.w)*1200;
    getCleanCrop(ctx, img, canvas, p.offset);
    const link = document.createElement('a'); link.download = `FnD-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
}

async function generatePDF() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    const sz = sizes[document.getElementById('size').value];
    let curX = 10, curY = 10;
    for (let p of photos) {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
        canvas.width = 1500; canvas.height = (sz.h/sz.w)*1500;
        getCleanCrop(ctx, img, canvas, p.offset);
        const finalImg = canvas.toDataURL('image/jpeg', 0.95);
        for (let i=0; i<p.qty; i++) {
            if (curX + sz.w > 200) { curX = 10; curY += sz.h + 2; }
            if (curY + sz.h > 285) { pdf.addPage(); curX = 10; curY = 10; }
            pdf.addImage(finalImg, 'JPEG', curX, curY, sz.w, sz.h); curX += sz.w + 2;
        }
    }
    pdf.save("Studio-FnD.pdf");
}
