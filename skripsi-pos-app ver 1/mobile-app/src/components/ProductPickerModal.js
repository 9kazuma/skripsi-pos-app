import React, { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

export default function ProductPickerModal({
  visible,
  products = [],
  title = 'Pilih Produk',
  onClose,
  onSelect,
  mode = 'sell', // sell | buy
}) {
  const groupedProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
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

    const groups = {};

    for (const item of sorted) {
      const groupKey = item.base_name || item.name || 'Tanpa Nama';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    }

    return groups;
  }, [products]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>{title}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {Object.entries(groupedProducts).map(([groupName, items]) => (
              <View key={groupName} style={styles.groupCard}>
                <Text style={styles.groupTitle}>{groupName}</Text>

                {items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.optionCard}
                    onPress={() => onSelect(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionName}>
                        {item.variant_name ? item.variant_name : 'Utama'}
                      </Text>
                      <Text style={styles.optionMeta}>
                        Stok: {item.stock}
                      </Text>
                      <Text style={styles.optionMeta}>
                        {mode === 'sell'
                          ? `Harga jual: ${formatCurrency(item.sell_price)}`
                          : `Harga beli: ${formatCurrency(item.buy_price)}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111827',
  },
  groupCard: {
    backgroundColor: '#eef4ff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  optionMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  closeButton: {
    marginTop: 8,
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontWeight: '700',
  },
});