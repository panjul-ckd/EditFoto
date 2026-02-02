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
            photos.push({ original: base64, noBg: noBg, current: base64, qty: 1 });
        } catch (e) {
            photos.push({ original: base64, current: base64, qty: 1 });
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
            <img src="${p.current}">
            <div style="flex:1">
                <input type="number" value="${p.qty}" min="1" onchange="photos[${i}].qty=parseInt(this.value);updatePreview()" style="width:40px">
                <div class="bg-options">
                    <button class="bg-btn" onclick="changeBg(${i}, 'original')">Asli</button>
                    <button class="bg-btn" style="background:red;color:white" onclick="changeBg(${i}, '#ff0000')">M</button>
                    <button class="bg-btn" style="background:blue;color:white" onclick="changeBg(${i}, '#0000ff')">B</button>
                </div>
                <button onclick="photos.splice(${i},1);renderPhotoList();updatePreview()" style="color:red;border:none;background:none;font-size:10px;cursor:pointer">Hapus</button>
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
    let x = 10, y = 10;
    photos.forEach(p => {
        for(let i=0; i<p.qty; i++) {
            const w = sz.w * scale, h = sz.h * scale;
            if (x + w > paper.offsetWidth - 10) { x = 10; y += h + 4; }
            if (y + h > paper.offsetHeight - 10) break;
            const div = document.createElement('div');
            div.className = 'preview-photo';
            Object.assign(div.style, { width: w+'px', height: h+'px', left: x+'px', top: y+'px', backgroundImage: `url(${p.current})` });
            paper.appendChild(div); x += w + 4;
        }
    });
}

async function generatePDF() {
    const { jsPDF } = window.jspdf; const pdf = new jsPDF('p', 'mm', 'a4');
    const sz = sizes[document.getElementById('size').value];
    let x = 10, y = 10;
    for (let p of photos) {
        for (let i=0; i<p.qty; i++) {
            if (x + sz.w > 200) { x = 10; y += sz.h + 2; }
            if (y + sz.h > 285) { pdf.addPage(); x = 10; y = 10; }
            pdf.addImage(p.current, 'PNG', x, y, sz.w, sz.h); x += sz.w + 2;
        }
    }
    pdf.save("cetak-fnd.pdf");
}
