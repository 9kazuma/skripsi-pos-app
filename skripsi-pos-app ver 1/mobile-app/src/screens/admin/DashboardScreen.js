import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart, LineChart } from 'react-native-chart-kit';
import ScreenContainer from '../../components/ScreenContainer';
import { api } from '../../api/client';

const screenWidth = Dimensions.get('window').width;

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatProductName(product) {
  if (!product) return '-';
  return `${product.base_name || product.name || 'Produk'}${
    product.variant_name ? ` - ${product.variant_name}` : ''
  }`;
}

function buildDashboardStockAlert(dashboardData) {
  const noStock = dashboardData?.outOfStock || [];
  const lowStock = dashboardData?.lowStock || [];

  if (!noStock.length && !lowStock.length) return null;

  const lines = [`Lokasi: ${dashboardData?.location?.name || 'Lokasi terpilih'}`];

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
        .map((item) => `• ${formatProductName(item)} (${item.stock}/${item.minimum_stock})`)
    );
  }

  if (noStock.length + lowStock.length > 5) {
    lines.push('');
    lines.push('Buka Produk atau Restock untuk melihat detail lengkap.');
  }

  return lines.join('\n');
}

function formatTime(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateGroup(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ProgressBar({ value, target, percent, color = '#2563eb' }) {
  const safePercent = Math.max(0, Math.min(Number(percent || 0), 100));

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.progressLabel}>
        {formatCurrency(value)} / {formatCurrency(target)}
      </Text>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${safePercent}%`, backgroundColor: color },
          ]}
        />
      </View>

      <Text style={styles.progressPercent}>{safePercent.toFixed(1)}%</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('week');
  const [cashierPeriod, setCashierPeriod] = useState('month');
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
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

  const loadDashboard = async () => {
    try {
      setRefreshing(true);
      const response = await api.get('/reports/dashboard', {
        params: {
          period,
          cashier_period: cashierPeriod,
          location_id: selectedLocationId || undefined,
        },
      });
      const dashboardData = response.data.data;
      setData(dashboardData);

      const alertMessage = buildDashboardStockAlert(dashboardData);
      const alertKey = JSON.stringify({
        locationId: dashboardData?.location?.id || selectedLocationId,
        outOfStock: (dashboardData?.outOfStock || []).map((item) => [item.id, item.stock]),
        lowStock: (dashboardData?.lowStock || []).map((item) => [item.id, item.stock, item.minimum_stock]),
      });

      if (alertMessage && alertKey !== stockAlertKeyRef.current) {
        stockAlertKeyRef.current = alertKey;
        Alert.alert('Peringatan Stok', alertMessage);
      }
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Tidak bisa memuat dashboard'
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (selectedLocationId) {
        loadDashboard();
      }
    }, [period, cashierPeriod, selectedLocationId])
  );

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#2563eb',
    },
  };

  const pieData = useMemo(() => {
    const totalProducts = Number(data?.productCount?.total_products || 0);
    const outOfStockCount = Number(
      data?.stockDistribution?.outOfStock ?? (data?.outOfStock || []).length
    );
    const lowStockCount = Number(
      data?.stockDistribution?.lowStock ?? (data?.lowStock || []).length
    );
    const safeStockCount = Number(
      data?.stockDistribution?.safeStock ?? Math.max(totalProducts - outOfStockCount - lowStockCount, 0)
    );

    if (totalProducts === 0) {
      return [
        {
          name: 'Belum Ada Produk',
          count: 1,
          color: '#d1d5db',
          legendFontColor: '#111827',
          legendFontSize: 12,
        },
      ];
    }

    return [
      {
        name: 'Habis',
        count: outOfStockCount,
        color: '#ef4444',
        legendFontColor: '#111827',
        legendFontSize: 12,
      },
      {
        name: 'Menipis',
        count: lowStockCount,
        color: '#facc15',
        legendFontColor: '#111827',
        legendFontSize: 12,
      },
      {
        name: 'Aman',
        count: safeStockCount,
        color: '#22c55e',
        legendFontColor: '#111827',
        legendFontSize: 12,
      },
    ];
  }, [data]);

  const trendData = useMemo(() => {
    const labels = (data?.salesTrend || []).map((item) => item.label || '-');
    const values = (data?.salesTrend || []).map((item) => Number(item.total || 0));

    return {
      labels: labels.length ? labels : ['-'],
      datasets: [{ data: values.length ? values : [0] }],
    };
  }, [data]);

  const groupedActivities = useMemo(() => {
    const groups = {};
    (data?.recentActivities || []).forEach((item) => {
      const dateKey = formatDateGroup(item.created_at);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [data]);

  const totalCashierSales = useMemo(() => {
    return (data?.cashierSales || []).reduce(
      (sum, item) => sum + Number(item.total_sales || 0),
      0
    );
  }, [data]);

  const growth = data?.profit?.growthPercentage;
  const growthText =
    growth === null || growth === undefined || Number.isNaN(Number(growth))
      ? 'Belum ada pembanding'
      : `${Number(growth) >= 0 ? '+' : ''}${Number(growth).toFixed(1)}%`;

  const cashierPeriodLabel =
    cashierPeriod === 'day' ? 'hari ini' : cashierPeriod === 'month' ? 'bulan ini' : 'tahun ini';

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadDashboard} />
        }
      >
        <Text style={styles.title}>Dashboard</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Location / Cabang</Text>
          <View style={styles.periodRow}>
            {locations.map((location) => (
              <Text
                key={location.id}
                style={[
                  styles.periodButton,
                  String(selectedLocationId) === String(location.id) && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedLocationId(location.id)}
              >
                {location.name}
              </Text>
            ))}
          </View>
          <Text style={styles.stockLegendText}>
            Data stok dashboard mengikuti lokasi {selectedLocation?.name || data?.location?.name || 'terpilih'}.
          </Text>
        </View>

        <View style={styles.periodRow}>
          {['week', 'month', 'year'].map((item) => (
            <Text
              key={item}
              style={[
                styles.periodButton,
                period === item && styles.periodButtonActive,
              ]}
              onPress={() => setPeriod(item)}
            >
              {item === 'week' ? 'Minggu' : item === 'month' ? 'Bulan' : 'Tahun'}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progress Penjualan Tahunan</Text>
          <Text style={styles.targetYearText}>
            Tahun {data?.targets?.targetYear || new Date().getFullYear()}
          </Text>

          <ProgressBar
            value={data?.targets?.currentYearSales}
            target={data?.targets?.annualTarget}
            percent={data?.targets?.annualProgressPercent}
            color="#2563eb"
          />
        </View>

        <View style={styles.cardLarge}>
          <Text style={styles.cardTitle}>Aktivitas Terakhir</Text>
          <ScrollView style={{ maxHeight: 280 }}>
            {Object.keys(groupedActivities).length === 0 ? (
              <Text>Tidak ada aktivitas</Text>
            ) : (
              Object.entries(groupedActivities).map(([date, items]) => (
                <View key={date} style={{ marginBottom: 12 }}>
                  <Text style={styles.groupDate}>{date}</Text>
                  {items.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.activityItem,
                        item.alert_level === 'danger' && styles.activityDanger,
                        item.alert_level === 'warning' && styles.activityWarning,
                      ]}
                    >
                      <Text
                        style={[
                          styles.activityTime,
                          item.alert_level === 'danger' && styles.activityDangerText,
                          item.alert_level === 'warning' && styles.activityWarningText,
                        ]}
                      >
                        {formatTime(item.created_at)}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.activityText,
                            item.alert_level === 'danger' && styles.activityDangerText,
                            item.alert_level === 'warning' && styles.activityWarningText,
                          ]}
                        >
                          {item.description || '-'}
                        </Text>
                        <Text style={styles.activityMeta}>
                          {item.user_name || '-'} ({item.role || '-'})
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        </View>

        <View style={styles.cardLarge}>
          <Text style={styles.cardTitle}>Tren Penjualan Harian</Text>
          <LineChart
            data={trendData}
            width={screenWidth - 60}
            height={240}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 16 }}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Laba / Rugi</Text>
          <Text>Laba Harian: {formatCurrency(data?.profit?.daily)}</Text>
          <Text>Laba Bulanan: {formatCurrency(data?.profit?.monthly)}</Text>
          <Text>Pertumbuhan: {growthText}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Distribusi Stok - {selectedLocation?.name || data?.location?.name || 'Lokasi'}</Text>
          <PieChart
            data={pieData}
            width={screenWidth - 60}
            height={220}
            chartConfig={chartConfig}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="8"
            absolute
          />
          <Text style={styles.stockLegendText}>
            Merah: stok habis • Kuning: stok menipis • Hijau: stok aman
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Penjualan ({cashierPeriodLabel})</Text>

          <View style={styles.periodRow}>
            {[
              { key: 'day', label: 'Harian' },
              { key: 'month', label: 'Bulanan' },
              { key: 'year', label: 'Tahunan' },
            ].map((item) => (
              <Text
                key={item.key}
                style={[
                  styles.periodButton,
                  cashierPeriod === item.key && styles.periodButtonActive,
                ]}
                onPress={() => setCashierPeriod(item.key)}
              >
                {item.label}
              </Text>
            ))}
          </View>

          {(data?.cashierSales || []).length === 0 ? (
            <Text>Belum ada data penjualan kasir</Text>
          ) : (
            <>
              {data.cashierSales.map((item) => (
                <View key={item.id} style={styles.cashierItem}>
                  <Text style={styles.cashierName}>{item.cashier_name}</Text>
                  <Text>Total Penjualan: {formatCurrency(item.total_sales)}</Text>
                  <Text>Total Transaksi: {item.total_transactions}</Text>
                </View>
              ))}

              <View style={styles.totalSalesBox}>
                <Text style={styles.totalSalesTitle}>Total Semua Kasir</Text>
                <Text style={styles.totalSalesValue}>{formatCurrency(totalCashierSales)}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Pembelian</Text>
          <Text>Bulan Ini: {formatCurrency(data?.salesPurchase?.purchases)}</Text>
          <Text>Diambil dari pembelian/restock admin</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Best Seller (bulan ini)</Text>
          {(data?.bestSellers || []).length === 0 ? (
            <Text>Belum ada data best seller</Text>
          ) : (
            data.bestSellers.map((item) => (
              <View key={item.id} style={styles.cashierItem}>
                <Text style={styles.cashierName}>
                  {item.base_name || item.name}
                  {item.variant_name ? ` - ${item.variant_name}` : ''}
                </Text>
                <Text>Jumlah terjual: {item.total_quantity}</Text>
                <Text>Total penjualan: {formatCurrency(item.total_sales)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  periodButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  periodButtonActive: {
    backgroundColor: '#2563eb',
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    elevation: 2,
    marginBottom: 12,
  },
  cardLarge: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    elevation: 2,
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  groupDate: {
    fontWeight: '700',
    marginBottom: 6,
    color: '#111827',
  },
  activityItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    alignItems: 'flex-start',
    padding: 8,
    borderRadius: 10,
  },
  activityDanger: {
    backgroundColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
  },
  activityWarning: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#facc15',
  },
  activityTime: {
    width: 48,
    fontWeight: '700',
    color: '#2563eb',
  },
  activityText: {
    color: '#111827',
  },
  activityDangerText: {
    color: '#991b1b',
    fontWeight: '700',
  },
  activityWarningText: {
    color: '#92400e',
    fontWeight: '700',
  },
  activityMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  progressLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  progressTrack: {
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 12,
    borderRadius: 999,
  },
  progressPercent: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  stockLegendText: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
  },
  cashierItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cashierName: {
    fontWeight: '700',
  },
  totalSalesBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  totalSalesTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  totalSalesValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  targetYearText: {
    fontWeight: '600',
    marginBottom: 8,
  },
});