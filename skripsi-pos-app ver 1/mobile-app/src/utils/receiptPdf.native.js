import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildReceiptHtml(selectedDetail) {
  const sale = selectedDetail.sale;
  const items = selectedDetail.items || [];

  const itemsHtml = items
    .map((item) => {
      const name = `${item.base_name || item.name || 'Produk'}${
        item.variant_name ? ` - ${item.variant_name}` : ''
      }`;

      return `
        <div class="item">
          <div class="item-name">${escapeHtml(name)}</div>
          <div class="row">
            <span>${escapeHtml(item.quantity)} x ${formatCurrency(item.price)}</span>
            <span>${formatCurrency(item.total)}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: monospace;
            font-size: 12px;
            padding: 12px;
            color: #111;
          }

          .receipt {
            width: 100%;
            max-width: 320px;
            margin: 0 auto;
          }

          h1 {
            font-size: 18px;
            text-align: center;
            margin: 0 0 8px;
          }

          .center {
            text-align: center;
          }

          .line {
            border-top: 1px dashed #111;
            margin: 10px 0;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
          }

          .item {
            margin-bottom: 8px;
          }

          .item-name {
            font-weight: bold;
            margin-bottom: 2px;
          }

          .total {
            font-weight: bold;
            font-size: 14px;
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <h1>INVOXA POS</h1>
          <div class="center">Bukti Transaksi</div>

          <div class="line"></div>

          <div>Transaksi: #${escapeHtml(sale.id || sale.sale_id || '-')}</div>
          <div>Kasir: ${escapeHtml(sale.cashier_name || '-')}</div>
          <div>Lokasi: ${escapeHtml(sale.location_name || '-')}</div>
          <div>Waktu: ${escapeHtml(formatDateTime(sale.created_at))}</div>
          <div>Metode: ${escapeHtml(sale.payment_method || '-')}</div>
          <div>Status: ${escapeHtml(sale.payment_status || 'confirmed')}</div>

          ${
            sale.qris_reference
              ? `<div>Ref QRIS: ${escapeHtml(sale.qris_reference)}</div>`
              : ''
          }

          ${
            sale.payment_proof_name
              ? `<div>Bukti Manual: ${escapeHtml(sale.payment_proof_name)}</div>`
              : ''
          }

          <div class="line"></div>

          ${itemsHtml}

          <div class="line"></div>

          <div class="row total">
            <span>Total</span>
            <span>${formatCurrency(sale.total_amount)}</span>
          </div>

          <div class="row">
            <span>Bayar</span>
            <span>${formatCurrency(sale.payment_amount)}</span>
          </div>

          <div class="row">
            <span>Kembali</span>
            <span>${formatCurrency(sale.change_amount)}</span>
          </div>

          <div class="line"></div>

          <div class="center">Terima kasih</div>
        </div>
      </body>
    </html>
  `;
}

export async function exportReceiptPdf(selectedDetail) {
  try {
    if (!selectedDetail?.sale) {
      return { ok: false, message: 'Detail transaksi belum tersedia' };
    }

    const html = buildReceiptHtml(selectedDetail);
    const { uri } = await Print.printToFileAsync({ html });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { ok: false, message: 'Fitur sharing tidak tersedia di perangkat ini' };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Bagikan PDF Struk',
      UTI: 'com.adobe.pdf',
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || 'Tidak bisa export PDF struk',
    };
  }
}

export async function printReceiptPdf(selectedDetail) {
  try {
    if (!selectedDetail?.sale) {
      return { ok: false, message: 'Detail transaksi belum tersedia' };
    }

    const html = buildReceiptHtml(selectedDetail);
    await Print.printAsync({ html });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error?.message || 'Tidak bisa print struk',
    };
  }
}