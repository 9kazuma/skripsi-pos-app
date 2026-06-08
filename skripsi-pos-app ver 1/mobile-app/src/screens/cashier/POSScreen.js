import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import ProductPickerModal from '../../components/ProductPickerModal';
import { api } from '../../api/client';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatProductName(product) {
  if (!product) return '-';
  return `${product.base_name || product.name || 'Produk'}${
    product.variant_name ? ` - ${product.variant_name}` : ''
  }`;
}

function buildStockAlert(products, locationName) {
  const activeProducts = products || [];
  const noStock = activeProducts.filter((item) => Number(item.stock || 0) <= 0);
  const lowStock = activeProducts.filter(
    (item) =>
      Number(item.stock || 0) > 0 &&
      Number(item.stock || 0) <= Number(item.minimum_stock || 0)
  );

  if (!noStock.length && !lowStock.length) return null;

  const lines = [`Lokasi: ${locationName || 'Lokasi terpilih'}`];

  if (noStock.length) {
    lines.push('');
    lines.push(`Stok habis (${noStock.length}):`);
    lines.push(
      ...noStock.slice(0, 5).map((item) => `• ${formatProductName(item)} (${item.stock})`)
    );
  }

  if (lowStock.length) {
    lines.push('');
    lines.push(`Stok menipis (${lowStock.length}):`);
    lines.push(
      ...lowStock
        .slice(0, 5)
        .map(
          (item) =>
            `• ${formatProductName(item)} (${item.stock}/${item.minimum_stock})`
        )
    );
  }

  if (noStock.length + lowStock.length > 5) {
    lines.push('');
    lines.push('Cek halaman produk/restock untuk detail lengkap.');
  }

  return lines.join('\n');
}

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Transfer Manual', value: 'manual_transfer' },
  { label: 'QRIS Otomatis', value: 'qris' },
];

export default function POSScreen() {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentProof, setPaymentProof] = useState(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [paymentMethodVisible, setPaymentMethodVisible] = useState(false);
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const stockAlertKeyRef = useRef('');

  const selectedLocation = locations.find((item) => String(item.id) === String(selectedLocationId));

  const loadLocations = async () => {
    try {
      const response = await api.get('/products/locations');
      const locationData = response.data.data || [];
      setLocations(locationData);
      if (!selectedLocationId && locationData.length > 0) {
        setSelectedLocationId(locationData[0].id);
      }
    } catch (error) {
      Alert.alert('Gagal', 'Tidak bisa memuat lokasi/cabang');
    }
  };

  const loadProducts = async () => {
    try {
      const response = await api.get('/products', {
        params: selectedLocationId ? { location_id: selectedLocationId } : {},
      });
      const productData = response.data.data || [];
      setProducts(productData);

      const alertMessage = buildStockAlert(productData, selectedLocation?.name);
      const alertKey = JSON.stringify({
        locationId: selectedLocationId,
        products: productData
          .filter((item) => Number(item.stock || 0) <= Number(item.minimum_stock || 0))
          .map((item) => [item.id, item.stock, item.minimum_stock]),
      });

      if (alertMessage && alertKey !== stockAlertKeyRef.current) {
        stockAlertKeyRef.current = alertKey;
        Alert.alert('Peringatan Stok', alertMessage);
      }

      if (!selectedProduct && productData.length > 0) {
        setSelectedProduct(productData[0]);
      } else if (selectedProduct) {
        const updated = productData.find((item) => item.id === selectedProduct.id);
        if (updated) {
          setSelectedProduct(updated);
        } else {
          setSelectedProduct(productData[0] || null);
        }
      }
    } catch (error) {
      Alert.alert('Gagal', 'Tidak bisa memuat daftar produk');
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (selectedLocationId) {
        loadProducts();
      }
    }, [selectedLocationId])
  );

  const total = useMemo(() => {
    return Number(selectedProduct?.sell_price || 0) * Number(quantity || 0);
  }, [selectedProduct, quantity]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== 'cash') return 0;
    return Number(paymentAmount || 0) - total;
  }, [paymentAmount, total, paymentMethod]);

  const selectedPaymentMethodLabel =
    PAYMENT_METHOD_OPTIONS.find((item) => item.value === paymentMethod)?.label || 'Cash';

  const pickPaymentProof = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Izin diperlukan', 'Izinkan akses galeri untuk memilih bukti pembayaran.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      const mimeType = asset.mimeType || 'image/jpeg';
      setPaymentProof({
        uri: asset.uri,
        name: asset.fileName || `bukti-pembayaran-${Date.now()}.jpg`,
        data: asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri,
      });
    } catch (error) {
      Alert.alert('Gagal', 'Tidak bisa memilih bukti pembayaran');
    }
  };

  const checkout = async () => {
    if (!selectedProduct?.id || Number(quantity) <= 0) {
      Alert.alert('Validasi', 'Pilih produk dan isi qty yang valid');
      return;
    }

    if (Number(selectedProduct.stock || 0) < Number(quantity || 0)) {
      Alert.alert('Validasi', 'Stok produk tidak mencukupi');
      return;
    }

    if (paymentMethod === 'cash' && Number(paymentAmount) < total) {
      Alert.alert('Validasi', 'Nominal pembayaran kurang');
      return;
    }

    try {
      const response = await api.post('/sales', {
        payment_amount: paymentMethod === 'cash' ? Number(paymentAmount) : total,
        payment_method: paymentMethod,
        payment_proof_name: paymentProof?.name || null,
        payment_proof_data: paymentProof?.data || null,
        qris_auto_confirm: paymentMethod === 'qris',
        location_id: Number(selectedLocationId),
        items: [{ product_id: Number(selectedProduct.id), quantity: Number(quantity) }],
      });

      const sale = response.data.data;

      await loadProducts();
      setQuantity('1');
      setPaymentAmount('');
      setPaymentMethod('cash');
      setPaymentProof(null);
      setLastSale(sale);
      setReceiptVisible(true);

      Alert.alert(
        'Transaksi berhasil',
        `Total: ${formatCurrency(sale.total_amount)}\nKembalian: ${formatCurrency(
          sale.change_amount
        )}\nStatus bayar: ${sale.payment_status || 'confirmed'}`
      );
    } catch (error) {
      Alert.alert(
        'Transaksi gagal',
        error.response?.data?.message || 'Terjadi kesalahan'
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Transaksi Penjualan</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Location / Cabang</Text>
          <View style={styles.locationButtonRow}>
            {locations.map((location) => (
              <TouchableOpacity
                key={location.id}
                style={[
                  styles.locationButton,
                  String(selectedLocationId) === String(location.id) && styles.locationButtonActive,
                ]}
                onPress={() => setSelectedLocationId(location.id)}
              >
                <Text
                  style={[
                    styles.locationButtonText,
                    String(selectedLocationId) === String(location.id) && styles.locationButtonTextActive,
                  ]}
                >
                  {location.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text>Lokasi transaksi: {selectedLocation?.name || '-'}</Text>

          <Text style={styles.label}>Pilih Produk</Text>

          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={styles.selectorText}>
              {selectedProduct ? formatProductName(selectedProduct) : 'Pilih produk'}
            </Text>
          </TouchableOpacity>

          <Text>Stok tersedia: {selectedProduct?.stock ?? 0}</Text>
          <Text>Harga jual: {formatCurrency(selectedProduct?.sell_price)}</Text>
          <Text>Satuan jual: {selectedProduct?.sell_unit || '-'}</Text>

          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="Qty"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Metode Bayar</Text>

          <TouchableOpacity
            style={styles.selectorButton}
            onPress={() => setPaymentMethodVisible(true)}
          >
            <Text style={styles.selectorText}>{selectedPaymentMethodLabel}</Text>
          </TouchableOpacity>

          {paymentMethod === 'manual_transfer' && (
            <View style={styles.paymentProofBox}>
              <Text style={styles.label}>Bukti Pembayaran Manual</Text>
              <Text style={styles.helperText}>
                Upload foto bukti pembayaran bersifat opsional.
              </Text>
              <Text style={styles.helperText}>
                Nominal transfer: {formatCurrency(total)}
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={pickPaymentProof}>
                <Text style={styles.secondaryButtonText}>
                  {paymentProof ? 'Ganti Bukti Pembayaran' : 'Upload Bukti Pembayaran'}
                </Text>
              </TouchableOpacity>
              {paymentProof && (
                <Text style={styles.proofText}>Terpilih: {paymentProof.name}</Text>
              )}
            </View>
          )}

          {paymentMethod === 'qris' && (
            <View style={styles.qrisBox}>
              <Text style={styles.label}>QRIS Otomatis</Text>
              <Text style={styles.helperText}>
                Pembayaran QRIS akan dikonfirmasi otomatis oleh payment gateway saat transaksi diselesaikan.
              </Text>
              <Text style={styles.helperText}>
                Nominal QRIS: {formatCurrency(total)}
              </Text>
            </View>
          )}

          {paymentMethod === 'cash' && (
            <>
              <TextInput
                style={styles.input}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="numeric"
                placeholder="Nominal pembayaran"
                placeholderTextColor="#6b7280"
              />

              <Text>
                Kembalian:{' '}
                {changeAmount >= 0 ? formatCurrency(changeAmount) : formatCurrency(0)}
              </Text>
            </>
          )}

          <Text>Total: {formatCurrency(total)}</Text>

          <Button title="Selesaikan Transaksi" onPress={checkout} />
        </View>
      </ScrollView>

      <ProductPickerModal
        visible={pickerVisible}
        products={products}
        title={`Pilih Produk Penjualan - ${selectedLocation?.name || 'Lokasi'}`}
        mode="sell"
        onClose={() => setPickerVisible(false)}
        onSelect={(item) => {
          setSelectedProduct(item);
          setPickerVisible(false);
        }}
      />

      <Modal visible={paymentMethodVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Metode Bayar</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {PAYMENT_METHOD_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.optionButton,
                    paymentMethod === item.value && styles.optionButtonActive,
                  ]}
                  onPress={() => {
                    setPaymentMethod(item.value);
                    setPaymentMethodVisible(false);
                    if (item.value !== 'cash') {
                      setPaymentAmount('');
                    }
                    if (item.value !== 'manual_transfer') {
                      setPaymentProof(null);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      paymentMethod === item.value && styles.optionTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setPaymentMethodVisible(false)}
              >
                <Text style={styles.closeModalText}>Tutup</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={receiptVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptCard}>
            <Text style={styles.modalTitle}>Bukti Transaksi / Receipt</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.receiptText}>Transaksi #{lastSale?.sale_id}</Text>
              <Text style={styles.receiptText}>
                Lokasi: {lastSale?.location_name || selectedLocation?.name || '-'}
              </Text>
              <Text style={styles.receiptText}>Metode: {lastSale?.payment_method}</Text>
              <Text style={styles.receiptText}>Status: {lastSale?.payment_status}</Text>
              {lastSale?.qris_reference ? (
                <Text style={styles.receiptText}>Ref QRIS: {lastSale.qris_reference}</Text>
              ) : null}
              {lastSale?.payment_proof_name ? (
                <Text style={styles.receiptText}>Bukti manual: {lastSale.payment_proof_name}</Text>
              ) : null}

              <View style={styles.receiptDivider} />

              {(lastSale?.items || []).map((item) => (
                <View key={`${item.product_id}-${item.quantity}`} style={styles.receiptItem}>
                  <Text style={styles.receiptText}>{item.product_name}</Text>
                  <Text style={styles.receiptText}>
                    {item.quantity} x {formatCurrency(item.price)} = {formatCurrency(item.total)}
                  </Text>
                </View>
              ))}

              <View style={styles.receiptDivider} />
              <Text style={styles.receiptTotal}>Total: {formatCurrency(lastSale?.total_amount)}</Text>
              <Text style={styles.receiptText}>
                Bayar: {formatCurrency(lastSale?.payment_amount)}
              </Text>
              <Text style={styles.receiptText}>
                Kembali: {formatCurrency(lastSale?.change_amount)}
              </Text>

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setReceiptVisible(false)}
              >
                <Text style={styles.closeModalText}>Tutup Receipt</Text>
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
  label: {
    fontWeight: '700',
    marginTop: 4,
  },
  helperText: {
    color: '#6b7280',
    fontSize: 12,
  },
  locationButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  locationButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  locationButtonActive: {
    backgroundColor: '#2563eb',
  },
  locationButtonText: {
    color: '#374151',
    fontWeight: '700',
  },
  locationButtonTextActive: {
    color: '#fff',
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  paymentProofBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    gap: 6,
  },
  qrisBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    gap: 6,
  },
  secondaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  proofText: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 12,
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
    maxHeight: '70%',
  },
  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
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
    marginTop: 12,
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#111827',
    fontWeight: '700',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  receiptItem: {
    marginBottom: 8,
  },
  receiptText: {
    color: '#111827',
    marginBottom: 3,
  },
  receiptTotal: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
});