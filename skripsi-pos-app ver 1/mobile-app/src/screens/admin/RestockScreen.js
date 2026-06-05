import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenContainer from '../../components/ScreenContainer';
import ProductPickerModal from '../../components/ProductPickerModal';
import { api } from '../../api/client';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

export default function RestockScreen() {
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [supplier, setSupplier] = useState('Supplier Utama');
  const [unitCost, setUnitCost] = useState('');
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
        setUnitCost(String(productData[0].buy_price || 0));
      } else if (selectedProduct) {
        const updated = productData.find((item) => item.id === selectedProduct.id);
        if (updated) {
          setSelectedProduct(updated);
          setUnitCost(String(updated.buy_price || 0));
        }
      }
    } catch (error) {
      Alert.alert('Gagal', 'Tidak bisa memuat produk');
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      setSelectedProduct(null);
      loadProducts();
    }
  }, [selectedLocationId]);

  const submit = async () => {
    try {
      await api.post('/inventory/stock-in', {
        product_id: Number(selectedProduct?.id),
        location_id: Number(selectedLocationId),
        quantity: Number(quantity),
        supplier_name: supplier,
        unit_cost: Number(unitCost || 0),
      });

      await loadProducts();
      setQuantity('1');

      Alert.alert('Berhasil', `Restock berhasil ditambahkan untuk ${selectedLocation?.name || 'lokasi terpilih'}`);
    } catch (error) {
      Alert.alert('Gagal', error.response?.data?.message || 'Tidak bisa restock');
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Pembelian / Restock Produk</Text>

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
        <Text>Stok saat ini: {selectedProduct?.stock ?? 0}</Text>
        <Text>Harga beli default: {formatCurrency(selectedProduct?.buy_price)}</Text>
        <Text>Satuan beli: {selectedProduct?.buy_unit || '-'}</Text>

        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="Jumlah"
        />

        <TextInput
          style={styles.input}
          value={unitCost}
          onChangeText={setUnitCost}
          keyboardType="numeric"
          placeholder="Harga beli per unit"
        />

        <TextInput
          style={styles.input}
          value={supplier}
          onChangeText={setSupplier}
          placeholder="Supplier"
        />

        <Button title="Simpan Pembelian" onPress={submit} />
      </View>

      <ProductPickerModal
        visible={pickerVisible}
        products={products}
        title={`Pilih Produk Restock - ${selectedLocation?.name || 'Lokasi'}`}
        mode="buy"
        onClose={() => setPickerVisible(false)}
        onSelect={(item) => {
          setSelectedProduct(item);
          setUnitCost(String(item.buy_price || 0));
          setPickerVisible(false);
        }}
      />
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
});
