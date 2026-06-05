import { jsPDF } from 'jspdf';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID');
}

export function exportReceiptPdf(selectedDetail) {
  if (!selectedDetail?.sale) {
    return { ok: false, message: 'Detail transaksi belum tersedia' };
  }

  const sale = selectedDetail.sale;
  const items = selectedDetail.items || [];

  const pageWidth = 58;
  const margin = 4;
  const contentWidth = pageWidth - margin * 2;

  const tempDoc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, 200],
  });

  let estimatedHeight = 10;
  estimatedHeight += 7;
  estimatedHeight += 5 * 4;
  estimatedHeight += 4;
  estimatedHeight += 5;
  estimatedHeight += 4;

  tempDoc.setFont('helvetica', 'normal');
  tempDoc.setFontSize(8);

  items.forEach((item) => {
    const itemName = `${item.base_name || item.name}${
      item.variant_name ? ` - ${item.variant_name}` : ''
    }`;

    const splitName = tempDoc.splitTextToSize(itemName, contentWidth);
    estimatedHeight += splitName.length * 3.6;
    estimatedHeight += 4.5;
    estimatedHeight += 2;
  });

  estimatedHeight += 4;
  estimatedHeight += 5 * 3;
  estimatedHeight += 8;

  const pageHeight = Math.max(estimatedHeight, 80);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  let y = 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('UMKM POS', pageWidth / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Transaksi #${sale.id}`, margin, y);

  y += 4;
  doc.text(`Kasir: ${sale.cashier_name || '-'}`, margin, y);

  y += 4;
  doc.text(`Lokasi: ${sale.location_name || '-'}`, margin, y);

  y += 4;
  doc.text(`Waktu: ${formatDateTime(sale.created_at)}`, margin, y);

  y += 4;
  doc.text(`Bayar: ${sale.payment_method || '-'}`, margin, y);

  y += 4;
  doc.text(`Status: ${sale.payment_status || 'confirmed'}`, margin, y);

  if (sale.qris_reference) {
    y += 4;
    doc.text(`QRIS: ${sale.qris_reference}`, margin, y);
  }

  if (sale.payment_proof_name) {
    y += 4;
    doc.text(`Bukti: ${sale.payment_proof_name}`, margin, y);
  }

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Item', margin, y);
  doc.text('Subtotal', pageWidth - margin, y, { align: 'right' });

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  items.forEach((item) => {
    const itemName = `${item.base_name || item.name}${
      item.variant_name ? ` - ${item.variant_name}` : ''
    }`;

    const splitName = doc.splitTextToSize(itemName, contentWidth);
    doc.text(splitName, margin, y);

    y += splitName.length * 3.6;

    doc.text(`${item.quantity} x ${formatCurrency(item.price)}`, margin, y);

    doc.text(formatCurrency(item.total), pageWidth - margin, y, {
      align: 'right',
    });

    y += 4.5;
  });

  doc.line(margin, y, pageWidth - margin, y);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Total', margin, y);
  doc.text(formatCurrency(sale.total_amount), pageWidth - margin, y, {
    align: 'right',
  });

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.text('Bayar', margin, y);
  doc.text(formatCurrency(sale.payment_amount), pageWidth - margin, y, {
    align: 'right',
  });

  y += 4.5;
  doc.text('Kembali', margin, y);
  doc.text(formatCurrency(sale.change_amount), pageWidth - margin, y, {
    align: 'right',
  });

  doc.save(`struk-transaksi-${sale.id}.pdf`);
  return { ok: true };
}