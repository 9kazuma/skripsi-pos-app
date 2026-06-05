import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import ProductPickerModal from '../../components/ProductPickerModal';
import { api } from '../../api/client';

export default function StockAdjustmentScreen() {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newStock, setNewStock] = useState('');
  const [reason, setReason] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);

  const selectedLocation = locations.find(
    (item) => String(item.id) === String(selectedLocationId)
  );

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

      if (!selectedProduct && productData.length > 0) {
        setSelectedProduct(productData[0]);
        setNewStock(String(productData[0].stock || 0));
      } else if (selectedProduct) {
        const updated = productData.find((item) => item.id === selectedProduct.id);
        if (updated) {
          setSelectedProduct(updated);
          setNewStock(String(updated.stock || 0));
        }
      }
    } catch (error) {
      Alert.alert('Gagal', 'Tidak bisa memuat produk');
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

  useEffect(() => {
    if (selectedLocationId) {
      setSelectedProduct(null);
      setNewStock('');
      loadProducts();
    }
  }, [selectedLocationId]);

  const submit = async () => {
    if (!selectedProduct?.id || newStock === '' || !reason.trim()) {
      Alert.alert('Validasi', 'Pilih produk, isi stok baru, dan alasan');
      return;
    }

    if (Number(newStock) < 0) {
      Alert.alert('Validasi', 'Stok baru tidak boleh negatif');
      return;
    }

    try {
      await api.post('/inventory/adjust', {
        product_id: Number(selectedProduct.id),
        location_id: Number(selectedLocationId),
        new_stock: Number(newStock),
        reason: reason.trim(),
      });

      Alert.alert('Berhasil', `Stock adjustment berhasil disimpan untuk ${selectedLocation?.name || 'lokasi terpilih'}`);
      setReason('');
      await loadProducts();
    } catch (error) {
      Alert.alert(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa melakukan adjustment'
      );
    }
  };

  const difference =
    selectedProduct ? Number(newStock || 0) - Number(selectedProduct.stock || 0) : 0;

  return (
    <ScreenContainer>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>← Kembali</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Stock Adjustment / Opname</Text>

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

        <Text style={styles.label}>Pilih Produk</Text>

        <TouchableOpacity
          style={styles.selectorButton}
          onPress={() => setPickerVisible(true)}
        >
          <Text style={styles.selectorText}>
            {selectedProduct
              ? `${selectedProduct.base_name || selectedProduct.name}${
                  selectedProduct.variant_name ? ` - ${selectedProduct.variant_name}` : ''
                }`
              : 'Pilih produk'}
          </Text>
        </TouchableOpacity>

        <Text>Lokasi: {selectedLocation?.name || '-'}</Text>
        <Text>Stok sistem saat ini: {selectedProduct?.stock ?? 0}</Text>
        <Text>Minimum stok: {selectedProduct?.minimum_stock ?? 0}</Text>

        <TextInput
          style={styles.input}
          value={newStock}
          onChangeText={setNewStock}
          keyboardType="numeric"
          placeholder="Stok fisik baru"
        />

        <TextInput
          style={styles.input}
          value={reason}
          onChangeText={setReason}
          placeholder="Alasan penyesuaian"
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Selisih stok: {Number.isNaN(difference) ? 0 : difference}
          </Text>
        </View>

        <Button title="Simpan Adjustment" onPress={submit} />
      </View>

      <ProductPickerModal
        visible={pickerVisible}
        products={products}
        title={`Pilih Produk Adjustment - ${selectedLocation?.name || 'Lokasi'}`}
        mode="buy"
        onClose={() => setPickerVisible(false)}
        onSelect={(item) => {
          setSelectedProduct(item);
          setNewStock(String(item.stock || 0));
          setPickerVisible(false);
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  backButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
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
  },
  label: {
    fontWeight: '700',
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
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 12,
  },
  infoText: {
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
