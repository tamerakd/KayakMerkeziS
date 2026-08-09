// OpenWeatherMap API Key
const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 saat (milisaniye cinsinden)

let kayakMerkezleri = {};
let mevcutYakinlasanSehir = null;
const ORJINAL_VIEWBOX = "0 0 1007.478 527.323"; // SVG'nin tam viewBox değeri

// 0. Haritaya Zoom Yapan Fonksiyon
function viewBoxAnimate(hedefViewBox) {
    const harita = document.querySelector('svg');
    if (harita) {
        harita.setAttribute('viewBox', hedefViewBox);
        harita.style.transition = "viewBox 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)"; // Yumuşak kamera geçişi
    }
}

// 1. JSON verisini çek
async function verileriYukle() {
    try {
        const response = await fetch('data/kayak-merkezleri.json');
        kayakMerkezleri = await response.json();
        olayDinleyicileriniAyarla();
    } catch (error) {
        console.error("Veriler yüklenirken hata oluştu:", error);
    }
}

// 2. 2 Saatlik Caching Mantığı ile Hava Durumu Çekme
async function havaDurumuGetir(sehirId, lat, lon) {
    const cacheKey = `hava_${sehirId}`;
    const cachedData = JSON.parse(localStorage.getItem(cacheKey));
    const suAn = new Date().getTime();

    // Cache'de veri varsa ve 2 saat geçmemişse, API'ye gitme!
    if (cachedData && (suAn - cachedData.timestamp < CACHE_TIME)) {
        return cachedData.temp;
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const temp = data.main.temp;

        // Gelen yeni veriyi saat damgasıyla Local Storage'a kaydet
        localStorage.setItem(cacheKey, JSON.stringify({
            temp: temp,
            timestamp: suAn
        }));

        return temp;
    } catch (error) {
        console.error("Hava durumu çekilemedi:", error);
        return "Hata";
    }
}

// 3. Etkileşimler (Hover, Tıklama ve Üste Taşıma)
function olayDinleyicileriniAyarla() {
    const aktifSehirler = document.querySelectorAll('.active-city');
    
    const infoBox = document.getElementById('info-box'); // Hareketli Kutu
    const panel = document.getElementById('top-left-panel'); // Sabit Panel
    
    const infoTesis = document.getElementById('info-tesis-adi');
    const infoSicaklik = document.getElementById('info-sicaklik');
    const infoSkipass = document.getElementById('info-skipass-fiyat');

    const panelBaslik = document.getElementById('panel-baslik');
    const panelSicaklik = document.getElementById('panel-sicaklik');
    const panelSkipass = document.getElementById('panel-skipass-fiyat');

    // Fare hangi şehrin üzerinde tutuluyor kontrolü
    let aktifHoverSehirId = null;

    aktifSehirler.forEach(sehir => {
        
        // --- FARE ŞEHRİN ÜZERİNE GELDİĞİNDE ---
        sehir.addEventListener('mouseenter', async function () {
            if (mevcutYakinlasanSehir !== null) return; 

            // ÇOK ÖNEMLİ HİLE: Şehir zaten en üstte değilse, onu SVG'nin en sonuna (en üste) taşı.
            // Bu sayede CSS animasyonu kesilmeden havaya kalkar ve diğer şehirlerin altında ezilmez.
            if (this.parentNode.lastElementChild !== this) {
                this.parentNode.appendChild(this);
            }

            const sehirId = this.id;
            aktifHoverSehirId = sehirId;
            const tesis = kayakMerkezleri[sehirId];

            if (tesis) {
                infoBox.classList.remove('hidden');
                infoTesis.innerText = tesis.tesis;
                infoSkipass.innerText = tesis.skipass;
                infoSicaklik.innerText = "Yükleniyor..."; 
                
                const sicaklik = await havaDurumuGetir(sehirId, tesis.lat, tesis.lon);
                
                // Eğer veri gelene kadar kullanıcı başka şehre geçmediyse yazdır
                if (aktifHoverSehirId === sehirId && !infoBox.classList.contains('hidden')) {
                    infoSicaklik.innerText = `${sicaklik} °C`;
                }
            }
        });

        // --- FARE ŞEHRİN ÜZERİNDE HAREKET ETTİĞİNDE ---
        sehir.addEventListener('mousemove', (e) => {
            if (mevcutYakinlasanSehir !== null) return; 
            
            // Tooltip fareyi takip eder
            infoBox.style.left = e.pageX + 15 + 'px';
            infoBox.style.top = e.pageY + 15 + 'px';
        });

        // --- FARE ŞEHİRDEN ÇIKTIĞINDA ---
        sehir.addEventListener('mouseleave', () => {
            aktifHoverSehirId = null; // Hover iptal
            infoBox.classList.add('hidden'); 
        });

        // --- ŞEHRE TIKLANDIĞINDA (ZOOM VE PANEL) ---
        sehir.addEventListener('click', async function (e) {
            e.stopPropagation(); 
            
            const sehirId = this.id;
            const tesis = kayakMerkezleri[sehirId];

            infoBox.classList.add('hidden');

            // Eğer zaten bu şehre zoom yapılmışsa (İkinci kez tıklandığında) uzaklaş
            if (mevcutYakinlasanSehir === sehirId) {
                viewBoxAnimate(ORJINAL_VIEWBOX);
                mevcutYakinlasanSehir = null;
                panel.classList.add('hidden'); 
                return;
            }

            // Yakınlaşma (Zoom) İşlemi
            const bbox = this.getBBox();
            const padding = 20; // Kameranın şehre ne kadar yaklaşacağı
            const hedefViewBox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding*2} ${bbox.height + padding*2}`;
            
            viewBoxAnimate(hedefViewBox);
            mevcutYakinlasanSehir = sehirId;

            // Sol Üstteki Sabit Paneli Göster
            if (tesis) {
                panelBaslik.innerText = `${tesis.tesis} (${sehirId.charAt(0).toUpperCase() + sehirId.slice(1)})`;
                panelSkipass.innerText = tesis.skipass;
                panelSicaklik.innerText = "Yükleniyor...";
                
                panel.classList.remove('hidden');

                const sicaklik = await havaDurumuGetir(sehirId, tesis.lat, tesis.lon);
                
                if (mevcutYakinlasanSehir === sehirId) {
                    panelSicaklik.innerText = `${sicaklik} °C`;
                }
            }
        });
    });

    // --- HARİTADA BOŞLUĞA (DENİZ/ARKAPLAN) TIKLANDIĞINDA ---
    document.addEventListener('click', () => {
        if (mevcutYakinlasanSehir !== null) {
            viewBoxAnimate(ORJINAL_VIEWBOX);
            mevcutYakinlasanSehir = null;
            panel.classList.add('hidden');
        }
    });
}

// Uygulamayı başlat
verileriYukle();