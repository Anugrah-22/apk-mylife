MYLIFE v5.1 — ANDROID PWA + FILE AUDIO FISIK (sounds/*.wav) & EDITOR JADWAL

ISI FOLDER PAKET:
- index.html             : Aplikasi utama MyLife v5.1 (pemutar file sounds/*.wav + editor jadwal)
- sw.js                  : Service Worker offline (otomatis menyimpan folder sounds/ ke cache)
- curriculum.json        : 65 materi kurikulum mandiri
- manifest.webmanifest   : Konfigurasi PWA Android
- icons/icon.svg         : Ikon aplikasi
- sounds/                : 6 file audio WAV fisik untuk masing-masing kategori kegiatan:
    1. sounds/ibadah.wav  (Gema Tenang — default untuk Subuh, Magrib, Isya)
    2. sounds/kerja.wav   (Tegas Profesional — default untuk jam kerja)
    3. sounds/belajar.wav (Fokus Ceria — default untuk sesi belajar)
    4. sounds/tidur.wav   (Lembut Malam — default untuk batas tidur & istirahat)
    5. sounds/energi.wav  (Energi Ringan — default untuk hiburan/olahraga)
    6. sounds/classic.wav (Lonceng Klasik)

CARA MENGGANTI FILE SUARA SECARA MANUAL:
Anda juga bisa menimpa langsung file di dalam folder sounds/ (misalnya mengganti ibadah.wav dengan rekaman azan/nada pilihan Anda sendiri dengan nama file yang sama).
