## Instalasi & Menjalankan Lokal

1. **Pasang dependensi**
   ```bash
   npm install
   ```
2. **Siapkan database PostgreSQL**
   - Buat database kosong bernama `ajucuti` di pgAdmin.
   - Buka Query Tool pada database tersebut, buka file `database/ajucuti.sql`, lalu jalankan (F5). File ini berisi struktur tabel, akun demo, jenis cuti, dan hari libur.
3. **Buat file `.env.local`** di root proyek:
   ```env
   DATABASE_URL="postgresql://postgres:PASSWORD_POSTGRES_ANDA@localhost:5432/ajucuti"
   DATABASE_SSL="false"
   JWT_SECRET="string-acak-minimal-32-karakter"
   NEXT_PUBLIC_APP_NAME="AjuCuti"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```
4. **Jalankan server**
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:3000`.

## Akun Demo

Semua akun memakai kata sandi `AjuCutiDisini!`.

| Role | Email | Username |
| :--- | :--- | :--- |
| Admin | `admin@ajucuti.local` | `admin` |
| HRD | `hrd@ajucuti.local` | `hrd` |
| Ketua Divisi IT | `leader.it@ajucuti.local` | `leader.it` |
| Ketua Divisi Keuangan | `leader.fin@ajucuti.local` | `leader.fin` |
| Karyawan | `andi@ajucuti.local` | `andi` |
| Karyawan | `dewi@ajucuti.local` | `dewi` |