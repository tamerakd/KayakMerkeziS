const API_KEY = "de49d9053cfc53fe23887484ae19baee"; // OpenWeatherMap API Key
const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 saat

let kayakMerkezleri = {};
let mevcutYakinlasanSehir = null;
const ORJINAL_VIEWBOX = "0 0 1007.478 527.323"; 

// --- YUMUŞAK VE AKICI VIEWBOX GEÇİŞİ (ANİMASYONLU) ---
// --- CSS İLE YUMUŞAK VE AKICI ZOOM (GPU HIZLANDIRMALI) ---
// --- SVG VIEWBOX İLE ANİMASYONLU, KESUNLİKLE PİKSELLEŞMEYEN ZOOM ---
function viewBoxAnimate(hedefViewBoxStr) {
    const svg = document.querySelector('svg');
    if (!svg) return;

    const mevcutViewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    const hedefViewBox = hedefViewBoxStr.split(' ').map(Number);

    const baslangicZamani = performance.now();
    const sure = 700; // 0.7 saniye (Hem akıcı hem hızlı)

    function adim(suAnZaman) {
        const gecenSure = suAnZaman - baslangicZamani;
        const oran = Math.min(gecenSure / sure, 1);
        
        // Yumuşak hızlanma ve yavaşlama (Ease-out efekti)
        const easeOrani = 1 - Math.pow(1 - oran, 3);

        const anlikX = mevcutViewBox[0] + (hedefViewBox[0] - mevcutViewBox[0]) * easeOrani;
        const anlikY = mevcutViewBox[1] + (hedefViewBox[1] - mevcutViewBox[1]) * easeOrani;
        const anlikGenislik = mevcutViewBox[2] + (hedefViewBox[2] - mevcutViewBox[2]) * easeOrani;
        const anlikYukseklik = mevcutViewBox[3] + (hedefViewBox[3] - mevcutViewBox[3]) * easeOrani;

        svg.setAttribute('viewBox', `${anlikX} ${anlikY} ${anlikGenislik} ${anlikYukseklik}`);

        if (oran < 1) {
            requestAnimationFrame(adim);
        }
    }

    requestAnimationFrame(adim);
}

// 1. JSON verisini çek ve önceden yükle
async function verileriYukle() {
    try {
        const response = await fetch('data/kayak-merkezleri.json');
        kayakMerkezleri = await response.json();
        olayDinleyicileriniAyarla();

        for (const sehirId in kayakMerkezleri) {
            const tesis = kayakMerkezleri[sehirId];
            havaDurumuGetir(sehirId, tesis.lat, tesis.lon); 
        }
    } catch (error) {
        console.error("Veriler yüklenirken hata oluştu:", error);
    }
}

// 2. Hava Durumu Çekme
async function havaDurumuGetir(sehirId, lat, lon) {
    const cacheKey = `hava_detay_${sehirId}`;
    const cachedData = JSON.parse(localStorage.getItem(cacheKey));
    const suAn = new Date().getTime();

    if (cachedData && (suAn - cachedData.timestamp < CACHE_TIME)) {
        return cachedData.veri; 
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=tr&appid=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();

        const havaDetaylari = {
            temp: Math.round(data.main.temp), 
            feelsLike: Math.round(data.main.feels_like), 
            desc: data.weather[0].description, 
            wind: data.wind.speed, 
            snow: data.snow ? data.snow["1h"] : 0 
        };

        localStorage.setItem(cacheKey, JSON.stringify({
            veri: havaDetaylari,
            timestamp: suAn
        }));

        return havaDetaylari;
    } catch (error) {
        console.error("Hava durumu çekilemedi:", error);
        return null;
    }
}

// 3. Etkileşimler
function olayDinleyicileriniAyarla() {
    const aktifSehirler = document.querySelectorAll('.active-city');
    
    const infoBox = document.getElementById('info-box');
    const panel = document.getElementById('top-left-panel');
    
    const infoTesis = document.getElementById('info-tesis-adi');
    const infoSicaklik = document.getElementById('info-sicaklik');
    const infoSkipass = document.getElementById('info-skipass-fiyat');

    const panelBaslik = document.getElementById('panel-baslik');
    const panelSicaklik = document.getElementById('panel-sicaklik');
    const panelSkipass = document.getElementById('panel-skipass-fiyat');
    const panelDurum = document.getElementById('panel-durum');
    const panelRuzgar = document.getElementById('panel-ruzgar');
    const panelKar = document.getElementById('panel-kar');

    let aktifHoverSehirId = null;

    aktifSehirler.forEach(sehir => {
        
        // --- MOUSEENTER ---
        sehir.addEventListener('mouseenter', async function () {
            // Zaten bir şehre yakınlaşılmışsa veya bu şehir kilitlendiyse (zoomed) hiçbir şey yapma
            if (mevcutYakinlasanSehir !== null || this.classList.contains('zoomed')) return; 

            if (this.parentNode.lastElementChild !== this) {
                this.parentNode.appendChild(this);
            }

            const sehirId = this.id;
            aktifHoverSehirId = sehirId;
            const tesis = kayakMerkezleri[sehirId];

            if (tesis) {
                infoBox.classList.remove('hidden');
                if(infoTesis) infoTesis.innerText = tesis.tesis;
                if(infoSkipass) infoSkipass.innerText = tesis.skipass;
                if(infoSicaklik) infoSicaklik.innerText = "Yükleniyor..."; 
                
                const hava = await havaDurumuGetir(sehirId, tesis.lat, tesis.lon);
                
                if (aktifHoverSehirId === sehirId && hava && !infoBox.classList.contains('hidden')) {
                    if(infoSicaklik) infoSicaklik.innerText = `${hava.temp} °C`;
                }
            }
        });

        // --- MOUSEMOVE ---
        sehir.addEventListener('mousemove', (e) => {
            if (mevcutYakinlasanSehir !== null || sehir.classList.contains('zoomed')) return; 
            infoBox.style.left = e.pageX + 15 + 'px';
            infoBox.style.top = e.pageY + 15 + 'px';
        });

        // --- MOUSELEAVE ---
        sehir.addEventListener('mouseleave', () => {
            aktifHoverSehirId = null;
            infoBox.classList.add('hidden'); 
        });

        // --- CLICK (YAKINLAŞMA) ---
        // --- ŞEHRE TIKLANDIĞINDA ---
        // --- ŞEHRE TIKLANDIĞINDA ---
        sehir.addEventListener('click', async function (e) {
            e.stopPropagation(); 
            
            const sehirId = this.id;
            const tesis = kayakMerkezleri[sehirId];

            infoBox.classList.add('hidden');

            if (mevcutYakinlasanSehir === sehirId) {
                viewBoxAnimate(ORJINAL_VIEWBOX);
                mevcutYakinlasanSehir = null;
                panel.classList.add('hidden'); 
                document.querySelectorAll('.active-city').forEach(c => c.classList.remove('zoomed'));
                return;
            }

            // --- NET VIEWBOX HESAPLAMA ---
            const bbox = this.getBBox();
            const padding = 25; // Kenarlardan bırakılacak boşluk payı
            const hedefViewBox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding*2} ${bbox.height + padding*2}`;
            
            viewBoxAnimate(hedefViewBox);
            // -----------------------------

            mevcutYakinlasanSehir = sehirId;

            document.querySelectorAll('.active-city').forEach(c => c.classList.add('zoomed'));

            if (tesis) {
                if(panelBaslik) panelBaslik.innerText = `${tesis.tesis} (${sehirId.charAt(0).toUpperCase() + sehirId.slice(1)})`;
                if(panelSkipass) panelSkipass.innerText = tesis.skipass;
                
                if(panelSicaklik) panelSicaklik.innerText = "Yükleniyor...";
                if(panelDurum) panelDurum.innerText = "Yükleniyor...";
                if(panelRuzgar) panelRuzgar.innerText = "Yükleniyor...";
                if(panelKar) panelKar.innerText = "Yükleniyor...";
                
                panel.classList.remove('hidden');

                const hava = await havaDurumuGetir(sehirId, tesis.lat, tesis.lon);
                
                if (mevcutYakinlasanSehir === sehirId && hava) {
                    if(panelSicaklik) panelSicaklik.innerText = `${hava.temp} °C (Hissedilen: ${hava.feelsLike} °C)`;
                    if(panelDurum) panelDurum.innerText = hava.desc.charAt(0).toUpperCase() + hava.desc.slice(1);
                    if(panelRuzgar) panelRuzgar.innerText = `${hava.wind} m/s`;
                    if(panelKar) panelKar.innerText = hava.snow > 0 ? `${hava.snow} mm` : "Yağış Yok";
                }
            }
        });
    });

    // --- BOŞLUĞA TIKLANDIĞINDA ---
    // --- HARİTADA BOŞLUĞA TIKLANDIĞINDA ---
    document.addEventListener('click', () => {
        if (mevcutYakinlasanSehir !== null) {
            viewBoxAnimate(ORJINAL_VIEWBOX);
            mevcutYakinlasanSehir = null;
            panel.classList.add('hidden');
            document.querySelectorAll('.active-city').forEach(c => c.classList.remove('zoomed'));
        }
    });
}

verileriYukle();