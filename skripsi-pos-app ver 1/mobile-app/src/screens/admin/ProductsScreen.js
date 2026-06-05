import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { api } from '../../api/client';

const emptyForm = {
  id: null,
  base_name: '',
  variant_name: '',
  category_name: '',
  sell_unit: '',
  sell_price: '',
  buy_unit: '',
  buy_price: '',
  stock: '0',
  minimum_stock: '5',
};

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function getStockPriority(stock, minimumStock) {
  const numericStock = Number(stock || 0);
  const numericMinimumStock = Number(minimumStock || 0);

  if (numericStock <= 0) return 0;
  if (numericMinimumStock > 0 && numericStock <= numericMinimumStock) return 1;
  return 2;
}

function getStockStatus(stock, minimumStock) {
  const priority = getStockPriority(stock, minimumStock);

  if (priority === 0) {
    return {
      label: 'Habis',
      badgeStyle: styles.stockBadgeDanger,
      textStyle: styles.stockBadgeTextLight,
      cardStyle: styles.productCardDanger,
    };
  }

  if (priority === 1) {
    return {
      label: 'Menipis',
      badgeStyle: styles.stockBadgeWarning,
      textStyle: styles.stockBadgeTextDark,
      cardStyle: styles.productCardWarning,
    };
  }

  return {
    label: 'Aman',
    badgeStyle: styles.stockBadgeSuccess,
    textStyle: styles.stockBadgeTextLight,
    cardStyle: styles.productCardSuccess,
  };
}

function getSearchText(item) {
  return [
    item.base_name,
    item.variant_name,
    item.category_name,
    item.name,
    item.sku,
    item.sell_unit,
    item.buy_unit,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const navigation = useNavigation();

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
      setLoading(true);
      const response = await api.get('/products', {
        params: selectedLocationId ? { location_id: selectedLocationId } : {},
      });
      setProducts(response.data.data || []);
    } catch (error) {
      Alert.alert('Gagal', 'Tidak bisa memuat produk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [selectedLocationId])
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return products;

    return products.filter((item) => getSearchText(item).includes(query));
  }, [products, searchQuery]);

  const groupedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a, b) => {
      const priorityCompare = getStockPriority(a.stock, a.minimum_stock) - getStockPriority(b.stock, b.minimum_stock);
      if (priorityCompare !== 0) return priorityCompare;

      const baseCompare = String(a.base_name || a.name || '').localeCompare(
        String(b.base_name || b.name || ''),
        'id'
      );

      if (baseCompare !== 0) return baseCompare;

      return String(a.variant_name || '').localeCompare(
        String(b.variant_name || ''),
        'id'
      );
    });

    const groupMap = {};

    for (const item of sorted) {
      const groupKey = item.base_name || item.name || 'Tanpa Nama';
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          priority: getStockPriority(item.stock, item.minimum_stock),
          items: [],
        };
      }

      groupMap[groupKey].priority = Math.min(
        groupMap[groupKey].priority,
        getStockPriority(item.stock, item.minimum_stock)
      );
      groupMap[groupKey].items.push(item);
    }

    return Object.entries(groupMap)
      .sort(([groupNameA, groupA], [groupNameB, groupB]) => {
        if (groupA.priority !== groupB.priority) {
          return groupA.priority - groupB.priority;
        }
        return groupNameA.localeCompare(groupNameB, 'id');
      })
      .map(([groupName, group]) => [groupName, group.items]);
  }, [filteredProducts]);

  const totalGroupedMenus = groupedProducts.length;

  const openCreateMainMenu = () => {
    setForm(emptyForm);
    setModalVisible(true);
  };

  const openAddVariant = (baseName, firstItem) => {
    setForm({
      id: null,
      base_name: baseName || '',
      variant_name: '',
      category_name: firstItem?.category_name || '',
      sell_unit: firstItem?.sell_unit || '',
      sell_price: '',
      buy_unit: firstItem?.buy_unit || '',
      buy_price: '',
      stock: '0',
      minimum_stock: String(firstItem?.minimum_stock || 5),
    });
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setForm({
      id: item.id,
      base_name: item.base_name || item.name || '',
      variant_name: item.variant_name || '',
      category_name: item.category_name || '',
      sell_unit: item.sell_unit || '',
      sell_price: String(item.sell_price || ''),
      buy_unit: item.buy_unit || '',
      buy_price: String(item.buy_price || ''),
      stock: String(item.stock || 0),
      minimum_stock: String(item.minimum_stock || 5),
    });
    setModalVisible(true);
  };

  const saveProduct = async () => {
    if (!form.base_name || !form.sell_unit || !form.buy_unit || !form.sell_price || !form.buy_price) {
      Alert.alert(
        'Validasi',
        'Lengkapi nama menu, satuan jual, harga jual, satuan beli, dan harga beli'
      );
      return;
    }

    const payload = {
      base_name: form.base_name,
      variant_name: form.variant_name,
      category_name: form.category_name,
      sell_unit: form.sell_unit,
      sell_price: Number(form.sell_price),
      buy_unit: form.buy_unit,
      buy_price: Number(form.buy_price),
      stock: Number(form.stock || 0),
      minimum_stock: Number(form.minimum_stock || 5),
      location_id: selectedLocationId,
    };

    try {
      if (form.id) {
        await api.put(`/products/${form.id}`, payload);
        Alert.alert('Berhasil', 'Produk berhasil diubah');
      } else {
        await api.post('/products', payload);
        Alert.alert(
          'Berhasil',
          form.variant_name ? 'Varian berhasil ditambahkan' : 'Menu utama berhasil ditambahkan'
        );
      }

      setModalVisible(false);
      setForm(emptyForm);
      await loadProducts();
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Tidak bisa menyimpan produk'
      );
    }
  };

  const removeProduct = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      await loadProducts();
      Alert.alert('Berhasil', 'Produk berhasil dihapus');
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Tidak bisa menghapus produk'
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Manajemen Produk</Text>
            <Text style={styles.subtitle}>
              Kelola menu utama dan variannya
            </Text>
          </View>

          <View style={styles.headerButtonGroup}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Restock')}
            >
              <Text style={styles.secondaryButtonText}>Restock</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Adjustment')}
            >
              <Text style={styles.secondaryButtonText}>Adjustment</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={openCreateMainMenu}>
              <Text style={styles.primaryText}>+ Tambah Menu</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.locationCard}>
          <Text style={styles.locationTitle}>Location / Cabang</Text>
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
          <Text style={styles.locationHint}>
            Stok yang tampil adalah stok untuk {selectedLocation?.name || 'lokasi terpilih'}.
          </Text>
        </View>

        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            placeholder="Cari produk, varian, kategori, SKU, atau satuan..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearSearchText}>Reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            Daftar Produk Prioritas Stok - {selectedLocation?.name || 'Lokasi'} {loading ? '(loading...)' : ''}
          </Text>
          <Text style={styles.summaryText}>
            Urutan: Habis (merah), Menipis (kuning), Aman (hijau)
          </Text>
          <Text style={styles.summaryText}>
            Total menu utama: {totalGroupedMenus}
          </Text>
          <Text style={styles.summaryText}>
            Total semua varian/produk: {filteredProducts.length} dari {products.length}
          </Text>
        </View>

        {groupedProducts.length === 0 ? (
          <View style={styles.emptySearchCard}>
            <Text style={styles.emptySearchText}>Produk tidak ditemukan.</Text>
          </View>
        ) : null}

        {groupedProducts.map(([groupName, items]) => (
          <View key={groupName} style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <View>
                <Text style={styles.groupTitle}>{groupName}</Text>
                <Text style={styles.groupCount}>{items.length} item</Text>
              </View>

              <TouchableOpacity
                style={styles.addVariantButton}
                onPress={() => openAddVariant(groupName, items[0])}
              >
                <Text style={styles.addVariantText}>+ Tambah Varian</Text>
              </TouchableOpacity>
            </View>

            {items.map((item) => {
              const stockStatus = getStockStatus(item.stock, item.minimum_stock);
              const hasVariant = Boolean(String(item.variant_name || '').trim());

              return (
                <View key={item.id} style={[styles.productCard, stockStatus.cardStyle]}>
                  <View style={styles.productTopRow}>
                    <View style={{ flex: 1 }}>
                      {hasVariant ? (
                        <Text style={styles.productVariant}>
                          Varian: {item.variant_name}
                        </Text>
                      ) : null}

                      <Text style={styles.productCategory}>
                        {item.category_name || 'Tanpa kategori'}
                      </Text>
                    </View>

                    <View style={[styles.stockBadgeBase, stockStatus.badgeStyle]}>
                      <Text style={[styles.stockBadgeTextBase, stockStatus.textStyle]}>
                        {stockStatus.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Satuan Jual</Text>
                      <Text style={styles.infoValue}>{item.sell_unit || '-'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Satuan Beli</Text>
                      <Text style={styles.infoValue}>{item.buy_unit || '-'}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Stok</Text>
                      <Text style={styles.infoValue}>{item.stock}</Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Minimum Stok</Text>
                      <Text style={styles.infoValue}>{item.minimum_stock || 0}</Text>
                    </View>
                  </View>

                  <View style={styles.priceRow}>
                    <View style={styles.priceBox}>
                      <Text style={styles.priceLabel}>Harga Beli</Text>
                      <Text style={styles.priceValue}>
                        {formatCurrency(item.buy_price)}
                      </Text>
                    </View>

                    <View style={styles.priceBox}>
                      <Text style={styles.priceLabel}>Harga Jual</Text>
                      <Text style={styles.priceValue}>
                        {formatCurrency(item.sell_price)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEdit(item)}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => removeProduct(item.id)}
                    >
                      <Text style={styles.actionButtonText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <Modal visible={modalVisible} animationType="fade" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {form.id
                  ? 'Edit Produk'
                  : form.base_name && form.variant_name === ''
                  ? `Tambah ${form.base_name}`
                  : 'Tambah Produk'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput
                  style={styles.input}
                  placeholder="Nama menu utama (contoh: Nasi Goreng)"
                  value={form.base_name}
                  onChangeText={(value) => setForm({ ...form, base_name: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Varian (contoh: Kambing / Gila)"
                  value={form.variant_name}
                  onChangeText={(value) => setForm({ ...form, variant_name: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Kategori barang"
                  value={form.category_name}
                  onChangeText={(value) => setForm({ ...form, category_name: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Satuan jual"
                  value={form.sell_unit}
                  onChangeText={(value) => setForm({ ...form, sell_unit: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Harga jual"
                  keyboardType="numeric"
                  value={form.sell_price}
                  onChangeText={(value) => setForm({ ...form, sell_price: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Satuan beli"
                  value={form.buy_unit}
                  onChangeText={(value) => setForm({ ...form, buy_unit: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Harga beli"
                  keyboardType="numeric"
                  value={form.buy_price}
                  onChangeText={(value) => setForm({ ...form, buy_price: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Stok awal"
                  keyboardType="numeric"
                  value={form.stock}
                  onChangeText={(value) => setForm({ ...form, stock: value })}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Minimum stok"
                  keyboardType="numeric"
                  value={form.minimum_stock}
                  onChangeText={(value) => setForm({ ...form, minimum_stock: value })}
                />

                <Button title="Simpan" onPress={saveProduct} />
                <View style={{ height: 8 }} />
                <Button
                  title="Tutup"
                  color="#6b7280"
                  onPress={() => {
                    setModalVisible(false);
                    setForm(emptyForm);
                  }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  headerButtonGroup: {
    gap: 8,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    color: '#6b7280',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  locationTitle: {
    fontWeight: '700',
    marginBottom: 8,
    color: '#111827',
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
  locationHint: {
    color: '#6b7280',
    fontSize: 12,
  },
  searchCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  clearSearchButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearSearchText: {
    color: '#111827',
    fontWeight: '700',
  },
  emptySearchCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 1,
  },
  emptySearchText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  summaryText: {
    color: '#6b7280',
  },
  groupCard: {
    backgroundColor: '#eef4ff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
    gap: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  groupCount: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginTop: 2,
  },
  addVariantButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addVariantText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    elevation: 1,
    borderLeftWidth: 6,
    borderLeftColor: '#16a34a',
  },
  productCardDanger: {
    borderLeftColor: '#dc2626',
    backgroundColor: '#fff7f7',
  },
  productCardWarning: {
    borderLeftColor: '#facc15',
    backgroundColor: '#fffbeb',
  },
  productCardSuccess: {
    borderLeftColor: '#16a34a',
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
    minHeight: 24,
  },
  productVariant: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  productCategory: {
    marginTop: 4,
    color: '#6b7280',
  },
  stockBadgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stockBadgeSuccess: {
    backgroundColor: '#16a34a',
  },
  stockBadgeWarning: {
    backgroundColor: '#facc15',
  },
  stockBadgeDanger: {
    backgroundColor: '#dc2626',
  },
  stockBadgeTextBase: {
    fontWeight: '700',
    fontSize: 12,
  },
  stockBadgeTextLight: {
    color: '#fff',
  },
  stockBadgeTextDark: {
    color: '#111827',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 10,
    minWidth: 100,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  infoValue: {
    fontWeight: '700',
    color: '#111827',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d4ed8',
    textAlign: 'right',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
});