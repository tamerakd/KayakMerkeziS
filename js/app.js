const API_KEY = "de49d9053cfc53fe23887484ae19baee"; // OpenWeatherMap API Key
const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 saat (milisaniye cinsinden)

let kayakMerkezleri = {};

// HATA ÖNLEME: Kodunuzda kullanılan ama tanımlanmamış global değişkenler eklendi
let mevcutYakinlasanSehir = null;
const ORJINAL_VIEWBOX = "0 0 1000 600"; // Kendi SVG'nizin orijinal viewBox değerini buraya yazın

// HATA ÖNLEME: viewBoxAnimate fonksiyonu yoktu, temel bir versiyon eklendi
function viewBoxAnimate(hedefViewBox) {
    const harita = document.querySelector('svg'); // Haritanızın seçicisine göre güncelleyin
    if (harita) {
        harita.setAttribute('viewBox', hedefViewBox);
        harita.style.transition = "viewBox 0.5s ease-in-out"; // CSS transition eklenebilir
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

// 3. Etkileşimler (Hover, Tıklama)
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

    // Fare hangi şehrin üzerinde tutuluyor kontrolü (Asenkron çakışmaları önlemek için)
    let aktifHoverSehirId = null;

    aktifSehirler.forEach(sehir => {
        
        // --- DÜZELTME 1: VERİ ÇEKME İŞLEMİ MOUSEENTER'A ALINDI ---
        sehir.addEventListener('mouseenter', async () => {
            if (mevcutYakinlasanSehir !== null) return; 

            const sehirId = sehir.id;
            aktifHoverSehirId = sehirId; // Hangi şehre girildiğini kaydet
            const tesis = kayakMerkezleri[sehirId];

            if (tesis) {
                infoBox.classList.remove('hidden');
                infoTesis.innerText = tesis.tesis;
                infoSkipass.innerText = tesis.skipass;
                infoSicaklik.innerText = "Yükleniyor..."; // Önceki şehrin verisi kalmasın
                
                const sicaklik = await havaDurumuGetir(sehirId, tesis.lat, tesis.lon);
                
                // Eğer veri gelene kadar kullanıcı başka şehre geçmediyse yazdır
                if (aktifHoverSehirId === sehirId && !infoBox.classList.contains('hidden')) {
                    infoSicaklik.innerText = `${sicaklik} °C`;
                }
            }
        });

        // --- DÜZELTME 2: MOUSEMOVE SADECE KUTUNUN KONUMUNU GÜNCELLER ---
        sehir.addEventListener('mousemove', (e) => {
            if (mevcutYakinlasanSehir !== null) return; 
            
            infoBox.style.left = e.pageX + 15 + 'px';
            infoBox.style.top = e.pageY + 15 + 'px';
        });

        // --- DURUM 2: FARE ŞEHİRDEN ÇIKTIĞINDA ---
        sehir.addEventListener('mouseleave', () => {
            aktifHoverSehirId = null; // Hover iptal edildi
            infoBox.classList.add('hidden'); 
        });

        // --- DURUM 3: ŞEHRE TIKLANDIĞINDA (ZOOM VE SABİT PANEL) ---
        sehir.addEventListener('click', async (e) => {
            e.stopPropagation(); 
            
            const sehirId = sehir.id;
            const tesis = kayakMerkezleri[sehirId];

            infoBox.classList.add('hidden');

            if (mevcutYakinlasanSehir === sehirId) {
                viewBoxAnimate(ORJINAL_VIEWBOX);
                mevcutYakinlasanSehir = null;
                panel.classList.add('hidden'); 
                return;
            }

            // Yakınlaşma (Zoom) İşlemi
            const bbox = sehir.getBBox();
            const padding = 30;
            const hedefViewBox = `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding*2} ${bbox.height + padding*2}`;
            
            viewBoxAnimate(hedefViewBox);
            mevcutYakinlasanSehir = sehirId;

            // Sol Üstteki Sabit Paneli Göster ve Doldur
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

    // --- DURUM 4: HARİTADA BOŞLUĞA TIKLANDIĞINDA ---
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