let photos = [];
const sizes = { 
    '2x3': {w: 21, h: 30}, '3x4': {w: 28, h: 38}, '4x6': {w: 38, h: 56}, 
    '4R': {w: 102, h: 152}, '8R': {w: 203, h: 254} 
};

async function handleUpload(event) {
    const loader = document.getElementById('loading');
    for (let file of event.target.files) {
        loader.style.display = 'block';
        const base64 = await new Promise(res => {
            const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file);
        });
        try {
            const blob = await imglyRemoveBackground(file);
            const noBg = URL.createObjectURL(blob);
            photos.push({ original: base64, noBg: noBg, current: base64, qty: 1, offset: 50 });
        } catch (e) {
            photos.push({ original: base64, current: base64, qty: 1, offset: 50 });
        }
        loader.style.display = 'none';
        renderPhotoList(); updatePreview();
    }
}

function renderPhotoList() {
    const container = document.getElementById('photoListContainer');
    container.innerHTML = '';
    
    // Hitung rasio kotak preview sidebar berdasarkan ukuran yang dipilih
    const sz = sizes[document.getElementById('size').value];
    const boxWidth = 80; 
    const boxHeight = (sz.h / sz.w) * boxWidth;

    photos.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <div class="single-preview-box" style="height: ${boxHeight}px">
                <div id="crop-prev-${i}" style="background-image: url('${p.current}'); background-position: center ${p.offset}%"></div>
            </div>
            <div style="flex:1">
                <label style="font-size:10px; color:#64748b;">↔️ Atur Posisi:</label>
                <input type="range" class="position-slider" min="0" max="100" value="${p.offset}" oninput="updateSingleCrop(${i}, this.value)">
                <div style="display:flex; gap:4px; align-items:center;">
                    <input type="number" value="${p.qty}" min="1" onchange="photos[${i}].qty=parseInt(this.value);updatePreview()" style="width:40px; padding:4px;">
                    <button class="bg-btn" style="background:red;color:white;border:none" onclick="changeBg(${i}, '#ff0000')">M</button>
                    <button class="bg-btn" style="background:blue;color:white;border:none" onclick="changeBg(${i}, '#0000ff')">B</button>
                    <button class="bg-btn" onclick="changeBg(${i}, 'original')">Asli</button>
                </div>
                <button onclick="downloadManualCrop(${i})" style="width:100%; background:#10b981; color:white; border:none; padding:6px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer; margin-top:8px">💾 Simpan Foto</button>
                <button onclick="photos.splice(${i},1);renderPhotoList();updatePreview()" style="color:red;border:none;background:none;font-size:10px;cursor:pointer;margin-top:4px">✕ Hapus</button>
            </div>`;
        container.appendChild(div);
    });
}

function updateSingleCrop(index, val) {
    photos[index].offset = val;
    document.getElementById(`crop-prev-${index}`).style.backgroundPosition = `center ${val}%`;
    updatePreview();
}

async function changeBg(index, color) {
    document.getElementById('loading').style.display = 'block';
    const p = photos[index];
    if (color === 'original') { p.current = p.original; } 
    else {
        const canvas = document.getElementById('tempCanvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.noBg; await new Promise(r => img.onload = r);
        canvas.width = img.width; canvas.height = img.height;
        ctx.fillStyle = color; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0); p.current = canvas.toDataURL('image/png');
    }
    renderPhotoList(); updatePreview();
    setTimeout(() => { document.getElementById('loading').style.display = 'none'; }, 500);
}

function updatePreview() {
    renderPhotoList(); // Memperbarui rasio kotak sidebar saat ukuran ganti
    const paper = document.getElementById('paper'); paper.innerHTML = '';
    const sz = sizes[document.getElementById('size').value];
    const scale = paper.offsetWidth / 210;
    let x = 12, y = 12;

    photos.forEach(p => {
        for(let i=0; i<p.qty; i++) {
            const w = sz.w * scale, h = sz.h * scale;
            if (x + w > paper.offsetWidth - 12) { x = 12; y += h + 4; }
            if (y + h > paper.offsetHeight - 12) break;
            const div = document.createElement('div');
            div.className = 'preview-photo';
            Object.assign(div.style, { 
                width: w+'px', height: h+'px', left: x+'px', top: y+'px', 
                backgroundImage: `url(${p.current})`, backgroundPosition: `center ${p.offset}%` 
            });
            paper.appendChild(div); x += w + 4;
        }
    });
}

async function downloadManualCrop(i) {
    const canvas = document.getElementById('tempCanvas'); const ctx = canvas.getContext('2d');
    const p = photos[i]; const sz = sizes[document.getElementById('size').value];
    const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
    canvas.width = 800; canvas.height = (sz.h/sz.w)*800;
    const sH = img.width*(sz.h/sz.w); const sY = (img.height-sH)*(p.offset/100);
    ctx.drawImage(img, 0, sY, img.width, sH, 0, 0, canvas.width, canvas.height);
    const link = document.createElement('a'); link.download = `FnD-${sz.w}x${sz.h}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png'); link.click();
}

async function generatePDF() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    const sz = sizes[document.getElementById('size').value];
    let curX = 10, curY = 10;
    for (let p of photos) {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
        canvas.width = 1000; canvas.height = (sz.h/sz.w)*1000;
        const sH = img.width*(sz.h/sz.w); const sY = (img.height-sH)*(p.offset/100);
        ctx.drawImage(img, 0, sY, img.width, sH, 0, 0, canvas.width, canvas.height);
        const finalImg = canvas.toDataURL('image/jpeg', 0.98);
        for (let i=0; i<p.qty; i++) {
            if (curX + sz.w > 200) { curX = 10; curY += sz.h + 2; }
            if (curY + sz.h > 285) { pdf.addPage(); curX = 10; curY = 10; }
            pdf.addImage(finalImg, 'JPEG', curX, curY, sz.w, sz.h); curX += sz.w + 2;
        }
    }
    pdf.save("hasil-cetak-fnd.pdf");
}