import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { exportReceiptPdf } from '../../utils/receiptPdf';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  const tanggal = date.toLocaleDateString('id-ID');
  const jam = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/\./g, ':');

  return `${tanggal}, ${jam}`;
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function SalesHistoryScreen() {
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  const loadSales = async (dateValue = selectedDate) => {
    try {
      setRefreshing(true);

      const params = {};
      if (dateValue) {
        params.start_date = dateValue;
        params.end_date = dateValue;
      }

      const response = await api.get('/sales', { params });
      setSales(response.data.data || []);
    } catch (error) {
      Alert.alert(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa memuat riwayat transaksi'
      );
    } finally {
      setRefreshing(false);
    }
  };

  const loadSaleDetail = async (saleId) => {
    try {
      const response = await api.get(`/sales/${saleId}`);
      setSelectedDetail(response.data.data);
      setDetailVisible(true);
    } catch (error) {
      Alert.alert(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa memuat detail transaksi'
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSales(selectedDate);
    }, [selectedDate])
  );

  const resetFilter = () => {
    setSelectedDate('');
  };

  const exportPdfReceipt = () => {
    const result = exportReceiptPdf(selectedDetail);

    if (!result?.ok) {
      Alert.alert('Info', result?.message || 'Tidak bisa export PDF');
    }
  };

  const printReceipt = () => {
    if (!selectedDetail?.sale) {
      Alert.alert('Info', 'Detail transaksi belum tersedia');
      return;
    }

    if (Platform.OS !== 'web') {
      Alert.alert('Info', 'Print struk saat ini tersedia di web');
      return;
    }

    const sale = selectedDetail.sale;
    const items = selectedDetail.items || [];

    const itemsHtml = items
      .map(
        (item) => `
          <div class="item-block">
            <div class="item-name">${item.base_name || item.name}${item.variant_name ? ` - ${item.variant_name}` : ''}</div>
            <div class="item-row">
              <span>${item.quantity} x ${formatCurrency(item.price)}</span>
              <span>${formatCurrency(item.total)}</span>
            </div>
          </div>
        `
      )
      .join('');

    const html = `
      <html>
        <head>
          <title></title>
          <style>
            @page {
              size: 58mm auto;
              margin: 3mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              width: 52mm;
              font-family: Arial, sans-serif;
              font-size: 10px;
              color: #000;
              background: #fff;
            }

            .receipt {
              width: 100%;
              padding: 0;
              margin: 0 auto;
            }

            .center {
              text-align: center;
            }

            .title {
              font-size: 14px;
              font-weight: 700;
              margin-bottom: 6px;
            }

            .line {
              border-top: 1px dashed #000;
              margin: 6px 0;
            }

            .meta {
              margin: 2px 0;
            }

            .header-row,
            .totals-row,
            .item-row {
              display: flex;
              justify-content: space-between;
              gap: 8px;
            }

            .header-row {
              font-weight: 700;
              margin-bottom: 4px;
            }

            .item-block {
              margin-bottom: 6px;
            }

            .item-name {
              margin-bottom: 2px;
              word-break: break-word;
            }

            .totals-row {
              margin: 3px 0;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center title">UMKM POS</div>

            <div class="meta">Transaksi #${sale.id}</div>
            <div class="meta">Kasir: ${sale.cashier_name || '-'}</div>
            <div class="meta">Lokasi: ${sale.location_name || '-'}</div>
            <div class="meta">Waktu: ${formatDateTime(sale.created_at)}</div>
            <div class="meta">Bayar: ${sale.payment_method || '-'}</div>
            <div class="meta">Status: ${sale.payment_status || 'confirmed'}</div>
            ${sale.qris_reference ? `<div class="meta">Ref QRIS: ${sale.qris_reference}</div>` : ''}
            ${sale.payment_proof_name ? `<div class="meta">Bukti: ${sale.payment_proof_name}</div>` : ''}

            <div class="line"></div>

            <div class="header-row">
              <span>Item</span>
              <span>Subtotal</span>
            </div>

            ${itemsHtml}

            <div class="line"></div>

            <div class="totals-row"><span>Total</span><span>${formatCurrency(sale.total_amount)}</span></div>
            <div class="totals-row"><span>Bayar</span><span>${formatCurrency(sale.payment_amount)}</span></div>
            <div class="totals-row"><span>Kembali</span><span>${formatCurrency(sale.change_amount)}</span></div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      Alert.alert('Gagal', 'Popup print diblokir browser');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.document.title = '';

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadSales()} />
        }
      >
        <Text style={styles.title}>
          {user?.role === 'cashier' ? 'Riwayat Transaksi Saya' : 'Riwayat Transaksi'}
        </Text>

        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Filter Tanggal Transaksi</Text>

          {Platform.OS === 'web' ? (
            <View style={styles.webDateWrapper}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </View>
          ) : null}

          <View style={styles.filterButtonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setSelectedDate(getTodayString())}
            >
              <Text style={styles.secondaryButtonText}>Hari Ini</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={resetFilter}
            >
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => loadSales(selectedDate)}
            >
              <Text style={styles.primaryButtonText}>Tampilkan</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterHint}>
            {selectedDate
              ? `Menampilkan transaksi tanggal ${selectedDate}`
              : 'Menampilkan semua transaksi'}
          </Text>
        </View>

        {sales.length === 0 ? (
          <View style={styles.card}>
            <Text>Belum ada transaksi</Text>
          </View>
        ) : (
          sales.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => loadSaleDetail(item.id)}
            >
              <Text style={styles.cardTitle}>Transaksi #{item.id}</Text>
              <Text>Kasir: {item.cashier_name}</Text>
              <Text>Lokasi: {item.location_name || '-'}</Text>
              <Text>Waktu: {formatDateTime(item.created_at)}</Text>
              <Text>Total item: {item.total_items}</Text>
              <Text>Total bayar: {formatCurrency(item.total_amount)}</Text>
              <Text>Metode bayar: {item.payment_method}</Text>
              <Text>Status bayar: {item.payment_status || 'confirmed'}</Text>
              {item.qris_reference ? <Text>Ref QRIS: {item.qris_reference}</Text> : null}
              <Text style={styles.detailHint}>Tekan untuk lihat detail</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={detailVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Detail Transaksi #{selectedDetail?.sale?.id || '-'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.summaryCard}>
                <Text>Kasir: {selectedDetail?.sale?.cashier_name || '-'}</Text>
                <Text>Lokasi: {selectedDetail?.sale?.location_name || '-'}</Text>
                <Text>Waktu: {formatDateTime(selectedDetail?.sale?.created_at)}</Text>
                <Text>Metode bayar: {selectedDetail?.sale?.payment_method || '-'}</Text>
                <Text>Status bayar: {selectedDetail?.sale?.payment_status || 'confirmed'}</Text>
                {selectedDetail?.sale?.qris_reference ? (
                  <Text>Ref QRIS: {selectedDetail.sale.qris_reference}</Text>
                ) : null}
                {selectedDetail?.sale?.payment_proof_name ? (
                  <Text>Bukti manual: {selectedDetail.sale.payment_proof_name}</Text>
                ) : null}
                <Text>Total: {formatCurrency(selectedDetail?.sale?.total_amount)}</Text>
                <Text>Pembayaran: {formatCurrency(selectedDetail?.sale?.payment_amount)}</Text>
                <Text>Kembalian: {formatCurrency(selectedDetail?.sale?.change_amount)}</Text>
              </View>

              {selectedDetail?.sale?.payment_proof_data ? (
                <View style={styles.proofPreviewBox}>
                  <Text style={styles.sectionTitle}>Preview Bukti Pembayaran</Text>
                  <Image
                    source={{ uri: selectedDetail.sale.payment_proof_data }}
                    style={styles.proofImage}
                    resizeMode="contain"
                  />
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Item Transaksi</Text>

              {(selectedDetail?.items || []).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>
                    {item.base_name || item.name}
                    {item.variant_name ? ` - ${item.variant_name}` : ''}
                  </Text>
                  <Text>Qty: {item.quantity}</Text>
                  <Text>Harga: {formatCurrency(item.price)}</Text>
                  <Text>Subtotal: {formatCurrency(item.total)}</Text>
                </View>
              ))}

              <View style={{ height: 12 }} />

              <TouchableOpacity style={styles.printButton} onPress={exportPdfReceipt}>
                <Text style={styles.printText}>Export PDF</Text>
              </TouchableOpacity>

              <View style={{ height: 8 }} />

              <TouchableOpacity style={styles.secondaryPrintButton} onPress={printReceipt}>
                <Text style={styles.secondaryPrintText}>Print Struk</Text>
              </TouchableOpacity>

              <View style={{ height: 8 }} />

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setDetailVisible(false);
                  setSelectedDetail(null);
                }}
              >
                <Text style={styles.closeText}>Tutup</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  filterCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    elevation: 2,
    marginBottom: 12,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  webDateWrapper: {
    width: '100%',
  },
  filterButtonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  filterHint: {
    color: '#6b7280',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 6,
    elevation: 2,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailHint: {
    marginTop: 6,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 2,
  },
  itemName: {
    fontWeight: '700',
  },
  proofPreviewBox: {
    marginTop: 12,
  },
  proofImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  printButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  printText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryPrintButton: {
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryPrintText: {
    color: '#fff',
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontWeight: '700',
  },
});