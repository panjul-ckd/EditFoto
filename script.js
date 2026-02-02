let photos = [];
const sizes = { '2x3': {w: 21, h: 30}, '3x4': {w: 28, h: 38}, '4x6': {w: 38, h: 56}, '4R': {w: 102, h: 152}, '8R': {w: 203, h: 254} };

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
    photos.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <img src="${p.current}" style="object-position: center ${p.offset}%">
            <div style="flex:1">
                <label style="font-size:11px">Geser Posisi Wajah:</label>
                <input type="range" class="position-slider" min="0" max="100" value="${p.offset}" 
                    oninput="photos[${i}].offset=this.value; updatePreview(); this.parentElement.parentElement.querySelector('img').style.objectPosition='center '+this.value+'%'">
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" value="${p.qty}" min="1" onchange="photos[${i}].qty=parseInt(this.value);updatePreview()" style="width:45px">
                    <div class="bg-options" style="flex:1">
                        <button class="bg-btn" onclick="changeBg(${i}, 'original')">Asli</button>
                        <button class="bg-btn" style="background:red;color:white" onclick="changeBg(${i}, '#ff0000')">M</button>
                        <button class="bg-btn" style="background:blue;color:white" onclick="changeBg(${i}, '#0000ff')">B</button>
                    </div>
                </div>
                <button onclick="photos.splice(${i},1);renderPhotoList();updatePreview()" style="color:red;border:none;background:none;font-size:10px;cursor:pointer;margin-top:5px">✕ Hapus Foto</button>
            </div>`;
        container.appendChild(div);
    });
}

async function changeBg(index, color) {
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
}

function updatePreview() {
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

async function generatePDF() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    const sz = sizes[document.getElementById('size').value];
    let curX = 10, curY = 10;
    for (let p of photos) {
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        const img = new Image(); img.src = p.current; await new Promise(res => img.onload = res);
        canvas.width = 600; canvas.height = (sz.h / sz.w) * 600;
        const offsetPercent = p.offset / 100;
        const sourceHeight = img.width * (sz.h / sz.w);
        const sourceY = (img.height - sourceHeight) * offsetPercent;
        ctx.drawImage(img, 0, sourceY, img.width, sourceHeight, 0, 0, canvas.width, canvas.height);
        const finalImg = canvas.toDataURL('image/jpeg', 0.9);
        for (let i=0; i<p.qty; i++) {
            if (curX + sz.w > 200) { curX = 10; curY += sz.h + 2; }
            if (curY + sz.h > 285) { pdf.addPage(); curX = 10; curY = 10; }
            pdf.addImage(finalImg, 'JPEG', curX, curY, sz.w, sz.h); curX += sz.w + 2;
        }
    }
    pdf.save("cetak-fnd-custom.pdf");
}
