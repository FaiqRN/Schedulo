# Schedulo - Kanban + Gantt (Chrome Extension)

Schedulo adalah extension Chrome popup yang menggabungkan papan Kanban dan Gantt chart dengan model data timeline-centric.

## Fitur Utama

- Kanban board di popup browser.
- Gantt chart yang terhubung langsung dengan task Kanban.
- Multi timeline.
- Rename timeline, edit start date, edit due date timeline.
- Validasi tanggal task agar selalu berada dalam rentang timeline aktif.
- Export board ke file Excel-compatible (`.xls`) dengan tampilan board.

## Cara Install (Load Unpacked)

1. Buka Chrome.
2. Buka `chrome://extensions/`.
3. Aktifkan `Developer mode`.
4. Klik `Load unpacked`.
5. Pilih folder proyek ini (`Schedulo`).

## Cara Pakai

1. Buka popup Schedulo dari toolbar Chrome.
2. Pilih timeline aktif dari dropdown timeline.
3. Gunakan `New TL` untuk membuat timeline baru.
4. Gunakan `Edit TL` untuk rename timeline dan atur rentang tanggal timeline.
5. Tambah list di mode Kanban dengan tombol `Add list`.
6. Tambah card di list, isi tanggal start/due sesuai rentang timeline.
7. Lihat representasi task di tab Gantt.
8. Gunakan `Export` untuk mengekspor board timeline aktif.

## Aturan Validasi Tanggal

- `card.start` dan `card.due` harus berada dalam rentang `timeline.start` sampai `timeline.due`.
- `card.due` tidak boleh lebih kecil dari `card.start`.
- Saat mengubah rentang timeline, perubahan ditolak jika ada task existing yang keluar rentang.

## Catatan Pengembangan

- Project ini tidak memakai framework build tool.
- Semua logic berjalan di browser popup context.
- Jika mengubah struktur data, jaga kompatibilitas migrasi data legacy agar user lama tidak kehilangan data.
