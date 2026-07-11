import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'cash' },
  { label: 'Transfer Manual', value: 'manual_transfer' },
  { label: 'QRIS Simulasi', value: 'qris' },
];

const money = (value) =>
  `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

function productName(product) {
  if (!product) return '-';

  const base = product.base_name || product.name || 'Produk';

  return product.variant_name
    ? `${base} - ${product.variant_name}`
    : base;
}

export default function POSScreen() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState(null);
  const [products, setProducts] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [cart, setCart] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentProof, setPaymentProof] = useState(null);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const [lastSale, setLastSale] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedLocation = useMemo(
    () =>
      locations.find(
        (item) => String(item.id) === String(locationId)
      ),
    [locations, locationId]
  );

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    [cart]
  );

  const totalItems = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.quantity,
        0
      ),
    [cart]
  );

  const change = Math.max(
    Number(paymentAmount || 0) - total,
    0
  );

  const paymentLabel =
    PAYMENT_METHODS.find(
      (item) => item.value === paymentMethod
    )?.label || 'Cash';

  const loadLocations = useCallback(async () => {
    try {
      const response = await api.get('/products/locations');
      const data = response.data?.data || [];

      setLocations(data);

      setLocationId(
        (current) => current || data[0]?.id || null
      );
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message ||
          'Tidak bisa memuat lokasi.'
      );
    }
  }, []);

  const loadProducts = useCallback(async () => {
    if (!locationId) return;

    try {
      const response = await api.get('/products', {
        params: {
          location_id: locationId,
        },
      });

      const data = response.data?.data || [];

      setProducts(data);

      setSelectedProduct((current) =>
        current
          ? data.find(
              (item) =>
                Number(item.id) === Number(current.id)
            ) || null
          : null
      );

      setCart((currentCart) =>
        currentCart
          .map((cartItem) => {
            const currentProduct = data.find(
              (item) =>
                Number(item.id) ===
                Number(cartItem.product_id)
            );

            if (!currentProduct) {
              return null;
            }

            return {
              ...cartItem,
              name: productName(currentProduct),
              price: Number(
                currentProduct.sell_price || 0
              ),
              stock: Number(
                currentProduct.stock || 0
              ),
              unit:
                currentProduct.sell_unit || '-',
            };
          })
          .filter(Boolean)
      );
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message ||
          'Tidak bisa memuat produk.'
      );
    }
  }, [locationId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setPaymentAmount(
        total > 0 ? String(total) : ''
      );
    }
  }, [paymentMethod, total]);

  function applyLocation(nextLocationId) {
    setLocationId(nextLocationId);
    setSelectedProduct(null);
    setQuantity('1');
    setCart([]);
    setPaymentAmount('');
    setPaymentProof(null);
  }

  function selectLocation(nextLocationId) {
    if (
      String(nextLocationId) === String(locationId)
    ) {
      return;
    }

    if (cart.length === 0) {
      applyLocation(nextLocationId);
      return;
    }

    Alert.alert(
      'Ganti lokasi?',
      'Keranjang akan dikosongkan karena stok setiap lokasi berbeda.',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Ganti',
          style: 'destructive',
          onPress: () =>
            applyLocation(nextLocationId),
        },
      ]
    );
  }

  function addToCart() {
    const qty = Number(quantity);

    if (!selectedProduct) {
      Alert.alert(
        'Validasi',
        'Pilih produk terlebih dahulu.'
      );
      return;
    }

    if (
      !Number.isInteger(qty) ||
      qty <= 0
    ) {
      Alert.alert(
        'Validasi',
        'Jumlah harus berupa angka bulat lebih dari 0.'
      );
      return;
    }

    const stock = Number(
      selectedProduct.stock || 0
    );

    const existing = cart.find(
      (item) =>
        Number(item.product_id) ===
        Number(selectedProduct.id)
    );

    const nextQty =
      Number(existing?.quantity || 0) + qty;

    if (nextQty > stock) {
      Alert.alert(
        'Stok tidak cukup',
        `Stok tersedia ${stock}. Saat ini di keranjang ${
          existing?.quantity || 0
        }.`
      );
      return;
    }

    setCart((currentCart) => {
      const exists = currentCart.some(
        (item) =>
          Number(item.product_id) ===
          Number(selectedProduct.id)
      );

      if (exists) {
        return currentCart.map((item) =>
          Number(item.product_id) ===
          Number(selectedProduct.id)
            ? {
                ...item,
                quantity: nextQty,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          product_id: Number(
            selectedProduct.id
          ),
          name: productName(selectedProduct),
          price: Number(
            selectedProduct.sell_price || 0
          ),
          quantity: qty,
          stock,
          unit:
            selectedProduct.sell_unit || '-',
        },
      ];
    });

    setSelectedProduct(null);
    setQuantity('1');
  }

  function changeCartQuantity(
    productId,
    difference
  ) {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (
          Number(item.product_id) !==
          Number(productId)
        ) {
          return [item];
        }

        const nextQty =
          item.quantity + difference;

        if (nextQty <= 0) {
          return [];
        }

        if (nextQty > item.stock) {
          Alert.alert(
            'Stok tidak cukup',
            `Stok tersedia ${item.stock}.`
          );

          return [item];
        }

        return [
          {
            ...item,
            quantity: nextQty,
          },
        ];
      })
    );
  }

  function removeItem(productId) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) =>
          Number(item.product_id) !==
          Number(productId)
      )
    );
  }

  function clearCart() {
    Alert.alert(
      'Kosongkan keranjang?',
      'Semua produk akan dihapus.',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Kosongkan',
          style: 'destructive',
          onPress: () => {
            setCart([]);
            setPaymentAmount('');
          },
        },
      ]
    );
  }

  async function pickProof() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Izin diperlukan',
          'Izinkan akses galeri untuk memilih bukti transfer.'
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset) {
        return;
      }

      const mimeType =
        asset.mimeType || 'image/jpeg';

      setPaymentProof({
        name:
          asset.fileName ||
          `bukti-transfer-${Date.now()}.jpg`,
        data: asset.base64
          ? `data:${mimeType};base64,${asset.base64}`
          : asset.uri,
      });
    } catch (error) {
      Alert.alert(
        'Gagal',
        'Bukti pembayaran tidak dapat dipilih.'
      );
    }
  }

  function resetForm() {
    setSelectedProduct(null);
    setQuantity('1');
    setCart([]);
    setPaymentMethod('cash');
    setPaymentAmount('');
    setPaymentProof(null);
  }

  async function checkout() {
    if (!locationId) {
      Alert.alert(
        'Validasi',
        'Pilih lokasi transaksi.'
      );
      return;
    }

    if (cart.length === 0) {
      Alert.alert(
        'Validasi',
        'Keranjang masih kosong.'
      );
      return;
    }

    if (
      Number(paymentAmount || 0) < total
    ) {
      Alert.alert(
        'Validasi',
        'Nominal pembayaran masih kurang.'
      );
      return;
    }

    const invalidItem = cart.find(
      (cartItem) => {
        const latest = products.find(
          (item) =>
            Number(item.id) ===
            Number(cartItem.product_id)
        );

        return (
          !latest ||
          cartItem.quantity >
            Number(latest.stock || 0)
        );
      }
    );

    if (invalidItem) {
      Alert.alert(
        'Stok berubah',
        `Stok ${invalidItem.name} tidak lagi mencukupi. Sesuaikan keranjang.`
      );

      await loadProducts();
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        '/sales',
        {
          location_id: Number(locationId),

          payment_amount: Number(
            paymentAmount
          ),

          payment_method: paymentMethod,

          payment_proof_name:
            paymentProof?.name || null,

          payment_proof_data:
            paymentProof?.data || null,

          qris_auto_confirm:
            paymentMethod === 'qris',

          items: cart.map((item) => ({
            product_id: Number(
              item.product_id
            ),
            quantity: Number(
              item.quantity
            ),
          })),
        }
      );

      const sale = response.data?.data;

      setLastSale(sale);
      setReceiptOpen(true);

      resetForm();

      await loadProducts();

      Alert.alert(
        'Transaksi berhasil',
        `Total: ${money(
          sale?.total_amount
        )}\nKembalian: ${money(
          sale?.change_amount
        )}`
      );
    } catch (error) {
      Alert.alert(
        'Transaksi gagal',
        error.response?.data?.message ||
          'Terjadi kesalahan pada server.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>
        Transaksi Penjualan
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          1. Pilih Lokasi dan Produk
        </Text>

        <Text style={styles.label}>
          Lokasi / Cabang
        </Text>

        <View style={styles.wrapRow}>
          {locations.map((location) => {
            const active =
              String(location.id) ===
              String(locationId);

            return (
              <TouchableOpacity
                key={location.id}
                style={[
                  styles.locationButton,
                  active &&
                    styles.locationButtonActive,
                ]}
                onPress={() =>
                  selectLocation(location.id)
                }
              >
                <Text
                  style={[
                    styles.locationButtonText,
                    active &&
                      styles.locationButtonTextActive,
                  ]}
                >
                  {location.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>
          Produk
        </Text>

        <TouchableOpacity
          style={styles.selector}
          onPress={() =>
            setProductPickerOpen(true)
          }
        >
          <Text style={styles.selectorText}>
            {selectedProduct
              ? productName(selectedProduct)
              : 'Pilih produk'}
          </Text>
        </TouchableOpacity>

        {selectedProduct ? (
          <View style={styles.infoBox}>
            <Text>
              Stok:{' '}
              {selectedProduct.stock || 0}
            </Text>

            <Text>
              Harga:{' '}
              {money(
                selectedProduct.sell_price
              )}{' '}
              /{' '}
              {selectedProduct.sell_unit ||
                '-'}
            </Text>
          </View>
        ) : null}

        <View style={styles.row}>
          <TextInput
            style={[
              styles.input,
              styles.quantityInput,
            ]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="Qty"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={addToCart}
          >
            <Text style={styles.buttonText}>
              Tambah ke Keranjang
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.betweenRow}>
          <View>
            <Text style={styles.sectionTitle}>
              2. Keranjang
            </Text>

            <Text style={styles.helper}>
              {cart.length} jenis •{' '}
              {totalItems} item
            </Text>
          </View>

          {cart.length > 0 ? (
            <TouchableOpacity
              onPress={clearCart}
            >
              <Text style={styles.danger}>
                Kosongkan
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              Keranjang masih kosong
            </Text>

            <Text style={styles.helper}>
              Pilih produk lalu tambahkan ke
              keranjang.
            </Text>
          </View>
        ) : (
          cart.map((item) => (
            <View
              key={item.product_id}
              style={styles.cartItem}
            >
              <View
                style={styles.betweenRow}
              >
                <View style={styles.flexOne}>
                  <Text
                    style={styles.itemName}
                  >
                    {item.name}
                  </Text>

                  <Text style={styles.helper}>
                    {money(item.price)} /{' '}
                    {item.unit}
                  </Text>

                  <Text style={styles.helper}>
                    Stok: {item.stock}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    removeItem(
                      item.product_id
                    )
                  }
                >
                  <Text
                    style={styles.danger}
                  >
                    Hapus
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={styles.betweenRow}
              >
                <View
                  style={
                    styles.quantityControl
                  }
                >
                  <TouchableOpacity
                    style={
                      styles.quantityButton
                    }
                    onPress={() =>
                      changeCartQuantity(
                        item.product_id,
                        -1
                      )
                    }
                  >
                    <Text
                      style={
                        styles.quantityButtonText
                      }
                    >
                      −
                    </Text>
                  </TouchableOpacity>

                  <Text
                    style={
                      styles.quantityValue
                    }
                  >
                    {item.quantity}
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.quantityButton
                    }
                    onPress={() =>
                      changeCartQuantity(
                        item.product_id,
                        1
                      )
                    }
                  >
                    <Text
                      style={
                        styles.quantityButtonText
                      }
                    >
                      +
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.subtotal}>
                  {money(
                    item.price *
                      item.quantity
                  )}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Total
          </Text>

          <Text style={styles.totalValue}>
            {money(total)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          3. Pembayaran
        </Text>

        <Text style={styles.label}>
          Metode Pembayaran
        </Text>

        <TouchableOpacity
          style={styles.selector}
          onPress={() =>
            setPaymentPickerOpen(true)
          }
        >
          <Text style={styles.selectorText}>
            {paymentLabel}
          </Text>
        </TouchableOpacity>

        {paymentMethod ===
        'manual_transfer' ? (
          <View style={styles.infoBox}>
            <Text style={styles.helper}>
              Nominal mengikuti total
              transaksi.
            </Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={pickProof}
            >
              <Text style={styles.buttonText}>
                {paymentProof
                  ? 'Ganti Bukti Transfer'
                  : 'Pilih Bukti Transfer'}
              </Text>
            </TouchableOpacity>

            {paymentProof ? (
              <Text style={styles.proof}>
                {paymentProof.name}
              </Text>
            ) : null}
          </View>
        ) : null}

        {paymentMethod === 'qris' ? (
          <View style={styles.qrisBox}>
            <Text style={styles.qrisTitle}>
              QRIS Simulasi
            </Text>

            <Text style={styles.helper}>
              Konfirmasi QRIS dilakukan
              otomatis oleh prototype, bukan
              payment gateway asli.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>
          Nominal Pembayaran
        </Text>

        <TextInput
          style={[
            styles.input,
            paymentMethod !== 'cash' &&
              styles.disabledInput,
          ]}
          value={paymentAmount}
          onChangeText={setPaymentAmount}
          keyboardType="number-pad"
          editable={
            paymentMethod === 'cash'
          }
          placeholder="Masukkan nominal pembayaran"
        />

        <View style={styles.summaryBox}>
          <View style={styles.betweenRow}>
            <Text>Total</Text>

            <Text style={styles.bold}>
              {money(total)}
            </Text>
          </View>

          <View style={styles.betweenRow}>
            <Text>Bayar</Text>

            <Text style={styles.bold}>
              {money(paymentAmount)}
            </Text>
          </View>

          <View style={styles.betweenRow}>
            <Text>Kembalian</Text>

            <Text style={styles.bold}>
              {money(change)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (loading ||
              cart.length === 0) &&
              styles.disabledButton,
          ]}
          disabled={
            loading || cart.length === 0
          }
          onPress={checkout}
        >
          <Text style={styles.buttonText}>
            {loading
              ? 'Memproses...'
              : 'Selesaikan Transaksi'}
          </Text>
        </TouchableOpacity>
      </View>

      <ProductPickerModal
        visible={productPickerOpen}
        products={products}
        title={`Pilih Produk - ${
          selectedLocation?.name ||
          'Lokasi'
        }`}
        mode="sell"
        onClose={() =>
          setProductPickerOpen(false)
        }
        onSelect={(product) => {
          setSelectedProduct(product);
          setProductPickerOpen(false);
        }}
      />

      <Modal
        visible={paymentPickerOpen}
        transparent
        animationType="fade"
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Pilih Metode Pembayaran
            </Text>

            {PAYMENT_METHODS.map(
              (method) => {
                const active =
                  method.value ===
                  paymentMethod;

                return (
                  <TouchableOpacity
                    key={method.value}
                    style={[
                      styles.option,
                      active &&
                        styles.optionActive,
                    ]}
                    onPress={() => {
                      setPaymentMethod(
                        method.value
                      );

                      setPaymentPickerOpen(
                        false
                      );

                      if (
                        method.value !==
                        'manual_transfer'
                      ) {
                        setPaymentProof(null);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        active &&
                          styles.optionTextActive,
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() =>
                setPaymentPickerOpen(false)
              }
            >
              <Text style={styles.closeText}>
                Tutup
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={receiptOpen}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptCard}>
            <Text style={styles.modalTitle}>
              Bukti Transaksi
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              <Text style={styles.receiptText}>
                Transaksi #
                {lastSale?.sale_id || '-'}
              </Text>

              <Text style={styles.receiptText}>
                Lokasi:{' '}
                {lastSale?.location_name ||
                  '-'}
              </Text>

              <Text style={styles.receiptText}>
                Metode:{' '}
                {lastSale?.payment_method ||
                  '-'}
              </Text>

              <Text style={styles.receiptText}>
                Status:{' '}
                {lastSale?.payment_status ||
                  '-'}
              </Text>

              {lastSale?.qris_reference ? (
                <Text
                  style={styles.receiptText}
                >
                  Referensi QRIS:{' '}
                  {lastSale.qris_reference}
                </Text>
              ) : null}

              <View style={styles.divider} />

              {(lastSale?.items || []).map(
                (item, index) => (
                  <View
                    key={`${item.product_id}-${index}`}
                    style={styles.receiptItem}
                  >
                    <Text
                      style={styles.itemName}
                    >
                      {item.product_name}
                    </Text>

                    <Text
                      style={
                        styles.receiptText
                      }
                    >
                      {item.quantity} ×{' '}
                      {money(item.price)} ={' '}
                      {money(item.total)}
                    </Text>
                  </View>
                )
              )}

              <View style={styles.divider} />

              <Text
                style={styles.receiptTotal}
              >
                Total:{' '}
                {money(
                  lastSale?.total_amount
                )}
              </Text>

              <Text style={styles.receiptText}>
                Bayar:{' '}
                {money(
                  lastSale?.payment_amount
                )}
              </Text>

              <Text style={styles.receiptText}>
                Kembalian:{' '}
                {money(
                  lastSale?.change_amount
                )}
              </Text>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() =>
                  setReceiptOpen(false)
                }
              >
                <Text style={styles.closeText}>
                  Tutup
                </Text>
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
    fontWeight: '800',
    color: '#111827',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    elevation: 2,
  },

  label: {
    fontWeight: '700',
    color: '#374151',
  },

  helper: {
    color: '#6b7280',
    fontSize: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  betweenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  flexOne: {
    flex: 1,
  },

  bold: {
    fontWeight: '800',
  },

  locationButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
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

  selector: {
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

  infoBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },

  quantityInput: {
    width: 82,
  },

  disabledInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },

  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },

  secondaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontWeight: '800',
  },

  danger: {
    color: '#dc2626',
    fontWeight: '700',
  },

  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },

  emptyTitle: {
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },

  cartItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },

  itemName: {
    fontWeight: '800',
    color: '#111827',
  },

  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    overflow: 'hidden',
  },

  quantityButton: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },

  quantityButtonText: {
    fontSize: 20,
    fontWeight: '800',
  },

  quantityValue: {
    minWidth: 42,
    textAlign: 'center',
    fontWeight: '800',
  },

  subtotal: {
    fontWeight: '800',
    color: '#111827',
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
  },

  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1d4ed8',
  },

  proof: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 12,
  },

  qrisBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },

  qrisTitle: {
    color: '#166534',
    fontWeight: '800',
  },

  summaryBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },

  checkoutButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  disabledButton: {
    backgroundColor: '#9ca3af',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },

  receiptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },

  option: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },

  optionActive: {
    backgroundColor: '#2563eb',
  },

  optionText: {
    color: '#111827',
    fontWeight: '700',
  },

  optionTextActive: {
    color: '#fff',
  },

  closeButton: {
    marginTop: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },

  closeText: {
    color: '#111827',
    fontWeight: '800',
  },

  divider: {
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
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
});