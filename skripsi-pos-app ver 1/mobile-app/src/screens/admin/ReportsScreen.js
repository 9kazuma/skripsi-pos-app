import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import ScreenContainer from '../../components/ScreenContainer';
import { api } from '../../api/client';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function getFirstDayOfMonthString() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return firstDay.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID');
}

function getCashierLabel(cashiers, cashierId) {
  if (!cashierId) return 'Semua Kasir';
  const found = cashiers.find((item) => Number(item.id) === Number(cashierId));
  return found ? found.name : 'Kasir dipilih';
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function makeSafeFileName(value) {
  return String(value || 'file')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState(getFirstDayOfMonthString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [report, setReport] = useState(null);
  const [cashierSummary, setCashierSummary] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [selectedCashierId, setSelectedCashierId] = useState('');
  const [cashierModalVisible, setCashierModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadCashiers = async () => {
    try {
      const response = await api.get('/reports/cashiers');
      setCashiers(response.data.data || []);
    } catch (error) {
      Alert.alert(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa memuat daftar kasir'
      );
    }
  };

  useEffect(() => {
    loadCashiers();
  }, []);

  const loadReport = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Validasi', 'Tanggal awal dan akhir harus diisi');
      return;
    }

    try {
      setLoading(true);

      const params = {
        start_date: startDate,
        end_date: endDate,
      };

      if (selectedCashierId) {
        params.cashier_id = selectedCashierId;
      }

      const [salesResponse, cashierResponse] = await Promise.all([
        api.get('/reports/sales-summary', { params }),
        api.get('/reports/cashier-summary', { params }),
      ]);

      setReport(salesResponse.data.data);
      setCashierSummary(cashierResponse.data.data || []);
    } catch (error) {
      Alert.alert(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa memuat laporan'
      );
    } finally {
      setLoading(false);
    }
  };

  const totalCashierSales = useMemo(() => {
    return cashierSummary.reduce(
      (sum, item) => sum + Number(item.total_sales || 0),
      0
    );
  }, [cashierSummary]);

  const totalCashierTransactions = useMemo(() => {
    return cashierSummary.reduce(
      (sum, item) => sum + Number(item.total_transactions || 0),
      0
    );
  }, [cashierSummary]);

  const exportCsv = async () => {
    if (!report) {
      Alert.alert('Info', 'Tampilkan laporan dulu sebelum export CSV');
      return;
    }

    const cashierLabel = getCashierLabel(cashiers, selectedCashierId);
    const lines = [];

    lines.push('LAPORAN PENJUALAN');
    lines.push(`Periode,${escapeCsv(startDate)} s/d ${escapeCsv(endDate)}`);
    lines.push(`Kasir,${escapeCsv(cashierLabel)}`);
    lines.push('');

    lines.push('RINGKASAN');
    lines.push('Total Transaksi,Total Penjualan,Rata-rata Transaksi');
    lines.push(
      [
        escapeCsv(report.summary?.total_transactions || 0),
        escapeCsv(report.summary?.total_sales || 0),
        escapeCsv(report.summary?.average_sale || 0),
      ].join(',')
    );
    lines.push('');

    lines.push('LAPORAN PER KASIR');
    lines.push('Nama Kasir,Total Transaksi,Total Penjualan,Rata-rata');
    cashierSummary.forEach((item) => {
      lines.push(
        [
          escapeCsv(item.cashier_name),
          escapeCsv(item.total_transactions),
          escapeCsv(item.total_sales),
          escapeCsv(item.average_sale),
        ].join(',')
      );
    });
    lines.push(
      [
        'TOTAL',
        escapeCsv(totalCashierTransactions),
        escapeCsv(totalCashierSales),
        '',
      ].join(',')
    );
    lines.push('');

    lines.push('DETAIL TRANSAKSI');
    lines.push('ID Transaksi,Kasir,Total,Waktu');
    (report.details || []).forEach((item) => {
      lines.push(
        [
          escapeCsv(item.id),
          escapeCsv(item.cashier_name),
          escapeCsv(item.total_amount),
          escapeCsv(formatDateTime(item.created_at)),
        ].join(',')
      );
    });

    const csvContent = '\uFEFF' + lines.join('\n');
    const safeCashierName = selectedCashierId
      ? makeSafeFileName(cashierLabel)
      : 'semua-kasir';
    const fileName = `laporan-${startDate}-${endDate}-${safeCashierName}.csv`;

    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', fileName);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
      Alert.alert('Berhasil', 'CSV berhasil diunduh');
      return;
    }

    try {
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const available = await Sharing.isAvailableAsync();

      if (!available) {
        Alert.alert('Info', 'Fitur sharing tidak tersedia di perangkat ini');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Bagikan CSV Laporan',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (error) {
      Alert.alert(
        'Gagal',
        error?.message || 'Tidak bisa membuat file CSV di mobile'
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Laporan Penjualan</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Filter Laporan</Text>

          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6b7280"
          />

          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#6b7280"
          />

          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setCashierModalVisible(true)}
          >
            <Text style={styles.selectorText}>
              {getCashierLabel(cashiers, selectedCashierId)}
            </Text>
          </TouchableOpacity>

          <View style={styles.filterActionRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setSelectedCashierId('')}
            >
              <Text style={styles.secondaryButtonText}>Reset Kasir</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Button
                title={loading ? 'Memuat...' : 'Tampilkan Laporan'}
                onPress={loadReport}
                disabled={loading}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.exportButton} onPress={exportCsv}>
            <Text style={styles.exportButtonText}>Download CSV</Text>
          </TouchableOpacity>
        </View>

        {report && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ringkasan Penjualan</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Periode</Text>
                <Text style={styles.summaryValue}>
                  {report.range?.start_date} s/d {report.range?.end_date}
                </Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Kasir</Text>
                <Text style={styles.summaryValue}>
                  {getCashierLabel(cashiers, selectedCashierId)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Total Transaksi</Text>
                <Text style={styles.summaryValue}>
                  {report.summary?.total_transactions || 0}
                </Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Total Penjualan</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(report.summary?.total_sales)}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Rata-rata</Text>
                <Text style={styles.summaryValue}>
                  {formatCurrency(report.summary?.average_sale)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {cashierSummary.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Laporan per Kasir</Text>

            {cashierSummary.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemTitle}>{item.cashier_name}</Text>
                <Text>Total transaksi: {item.total_transactions}</Text>
                <Text>Total penjualan: {formatCurrency(item.total_sales)}</Text>
                <Text>Rata-rata transaksi: {formatCurrency(item.average_sale)}</Text>
              </View>
            ))}

            <View style={styles.totalBox}>
              <Text style={styles.totalTitle}>Total</Text>
              <Text>Total transaksi: {totalCashierTransactions}</Text>
              <Text>Total penjualan: {formatCurrency(totalCashierSales)}</Text>
            </View>
          </View>
        )}

        {report?.details?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Detail Transaksi</Text>

            {report.details.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemTitle}>Transaksi #{item.id}</Text>
                <Text>Kasir: {item.cashier_name}</Text>
                <Text>Total: {formatCurrency(item.total_amount)}</Text>
                <Text>Waktu: {formatDateTime(item.created_at)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={cashierModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Kasir</Text>

            <TouchableOpacity
              style={[
                styles.optionButton,
                !selectedCashierId && styles.optionButtonActive,
              ]}
              onPress={() => {
                setSelectedCashierId('');
                setCashierModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.optionText,
                  !selectedCashierId && styles.optionTextActive,
                ]}
              >
                Semua Kasir
              </Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {cashiers.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionButton,
                    Number(selectedCashierId) === Number(item.id) &&
                      styles.optionButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedCashierId(String(item.id));
                    setCashierModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      Number(selectedCashierId) === Number(item.id) &&
                        styles.optionTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setCashierModalVisible(false)}
              >
                <Text style={styles.closeModalText}>Tutup</Text>
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
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  selectorButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  selectorText: {
    color: '#111827',
    fontWeight: '600',
  },
  filterActionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  exportButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontWeight: '700',
    color: '#111827',
  },
  itemRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 2,
  },
  itemTitle: {
    fontWeight: '700',
  },
  totalBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    gap: 4,
  },
  totalTitle: {
    fontWeight: '700',
    color: '#2563eb',
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
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  optionButtonActive: {
    backgroundColor: '#2563eb',
  },
  optionText: {
    color: '#111827',
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#fff',
  },
  closeModalButton: {
    marginTop: 8,
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#111827',
    fontWeight: '700',
  },
});