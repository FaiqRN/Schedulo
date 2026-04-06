# Schedulo - Kanban + Gantt (Chrome Extension)

Schedulo adalah extension Chrome popup yang menggabungkan papan Kanban dan Gantt chart dengan model data project-centric.

Struktur data utama sekarang:

- Project -> Timelines -> Lists -> Cards

## Fitur Utama

- Menu Project sebagai induk semua timeline Kanban dan Gantt.
- Buat project baru langsung siap pakai (otomatis dibuatkan 1 timeline default).
- Pilih project dari dropdown dan langsung masuk ke Kanban.
- Multi project, multi timeline per project.
- Rename dan delete project.
- Kanban board di popup browser.
- Gantt chart yang terhubung langsung dengan task Kanban.
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
2. Jika belum ada project, buat project baru di tab `Project`.
3. Jika sudah ada project, pilih dari dropdown di tab `Project` untuk langsung masuk ke Kanban.
4. Untuk sesi berikutnya, popup akan langsung membuka project terakhir yang digunakan.
5. Kapan pun, klik tab `Project` untuk berpindah project lain, rename project, atau delete project.
6. Setelah project aktif, pilih timeline aktif dari dropdown timeline.
7. Gunakan tombol `Add list` saat di tab Kanban untuk menambah list.
8. Gunakan tombol `Add timeline` saat di tab Gantt untuk menambah timeline.
9. Gunakan `Edit TL` untuk rename timeline dan atur rentang tanggal timeline.
10. Tambah card di list, isi tanggal start/due sesuai rentang timeline.
11. Lihat representasi task di tab Gantt.
12. Gunakan `Export` untuk mengekspor data tampilan aktif.

## Catatan Delete Project

- Delete project akan langsung menghapus project beserta seluruh timeline dan task di dalamnya.
- Tidak ada pemindahan data ke project lain saat delete project.

## Aturan Validasi Tanggal

- `card.start` dan `card.due` harus berada dalam rentang `timeline.start` sampai `timeline.due`.
- `card.due` tidak boleh lebih kecil dari `card.start`.
- Saat mengubah rentang timeline, perubahan ditolak jika ada task existing yang keluar rentang.

## Catatan Pengembangan

- Project ini tidak memakai framework build tool.
- Semua logic berjalan di browser popup context.
- Data legacy timeline-centric dimigrasikan otomatis ke format project-centric agar data lama tetap aman.
