# UMKM POS & Inventory Starter Project

Starter project ini dibuat dari spesifikasi skripsi untuk aplikasi Point of Sales dan manajemen inventori UMKM.

## Stack yang dipakai
- Mobile app: React Native (Expo)
- Backend API: Node.js + Express
- Database: MySQL
- Arsitektur: client-server + REST API + JSON

## Fitur yang sudah dicakup
1. Login berdasarkan role admin/pemilik dan kasir
2. Manajemen produk
3. Stock in / restock
4. Transaksi penjualan (POS)
5. Laporan penjualan
6. Dashboard ringkas

## Struktur folder
- `backend/` REST API Express
- `mobile-app/` aplikasi React Native
- `docs/database.sql` skema database dan seed data

## Cara menjalankan backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Cara menjalankan mobile app
```bash
cd mobile-app
npm install
npm start
```

Lalu ganti `YOUR_LOCAL_IP` pada `mobile-app/src/api/client.js` dengan IP laptop/server kamu.

## Akun demo
- Admin: `admin` / `password123`
- Kasir: `cashier` / `password123`

## Mapping ke use case skripsi
- UC-01 Login -> `POST /api/auth/login`
- UC-02 Manajemen Produk -> `GET/POST/PUT/DELETE /api/products`
- UC-03 Stock In / Restock -> `POST /api/inventory/stock-in`
- UC-04 Transaksi Penjualan -> `POST /api/sales`
- UC-05 Laporan Penjualan -> `GET /api/reports/sales-summary`

## Catatan penting
- Ini adalah starter code yang cukup kuat untuk dijadikan dasar skripsi/prototype.
- Belum mencakup upload bukti pembayaran, export PDF/Excel, barcode scanner, dan penyimpanan token lokal.
- Jika mau dijadikan aplikasi final untuk sidang, langkah berikutnya adalah menambahkan validasi UI yang lebih rapi, state management yang lebih besar, testing, dan deployment.
