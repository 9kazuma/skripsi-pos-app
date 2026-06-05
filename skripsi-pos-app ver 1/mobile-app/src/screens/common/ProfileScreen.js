import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();

  const [activeSection, setActiveSection] = useState('profile');

  const [name, setName] = useState(user?.name || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [annualTarget, setAnnualTarget] = useState('');

  const loadTarget = async () => {
    try {
      const response = await api.get('/reports/targets/current');
      setTargetYear(String(response.data.data?.targetYear || new Date().getFullYear()));
      setAnnualTarget(String(response.data.data?.annualTarget || ''));
    } catch (_error) {}
  };

  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'owner') {
        loadTarget();
      }
    }, [user?.role])
  );

  const saveProfile = async () => {
    try {
      const response = await api.put('/auth/profile', {
        name,
        whatsapp,
        email,
      });

      updateUser(response.data.data);
      Alert.alert('Berhasil', 'Data diri berhasil diperbarui');
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Tidak bisa update data diri'
      );
    }
  };

  const changePassword = async () => {
    try {
      await api.put('/auth/profile', {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Berhasil', 'Password berhasil diubah');
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Tidak bisa mengubah password'
      );
    }
  };

  const saveTarget = async () => {
    try {
      await api.post('/reports/targets', {
        target_year: Number(targetYear),
        annual_target_amount: Number(annualTarget || 0),
      });

      Alert.alert('Berhasil', 'Target penjualan tahunan berhasil disimpan');
    } catch (error) {
      Alert.alert(
        'Gagal',
        error.response?.data?.message || 'Tidak bisa menyimpan target'
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.title}>Profil Pengguna</Text>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeSection === 'profile' && styles.tabButtonActive]}
              onPress={() => setActiveSection('profile')}
            >
              <Text style={[styles.tabText, activeSection === 'profile' && styles.tabTextActive]}>
                Data Diri
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeSection === 'password' && styles.tabButtonActive]}
              onPress={() => setActiveSection('password')}
            >
              <Text style={[styles.tabText, activeSection === 'password' && styles.tabTextActive]}>
                Change Password
              </Text>
            </TouchableOpacity>

            {user?.role === 'owner' && (
              <TouchableOpacity
                style={[styles.tabButton, activeSection === 'target' && styles.tabButtonActive]}
                onPress={() => setActiveSection('target')}
              >
                <Text style={[styles.tabText, activeSection === 'target' && styles.tabTextActive]}>
                  Target Penjualan
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {activeSection === 'profile' && (
            <>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nama"
              />

              <TextInput
                style={[styles.input, styles.lockedInput]}
                value={user?.role || ''}
                editable={false}
                placeholder="Role"
              />

              <TextInput
                style={styles.input}
                value={whatsapp}
                onChangeText={setWhatsapp}
                placeholder="No Whatsapp"
              />

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
              />

              <TouchableOpacity style={styles.primaryButton} onPress={saveProfile}>
                <Text style={styles.primaryText}>Simpan Data Diri</Text>
              </TouchableOpacity>
            </>
          )}

          {activeSection === 'password' && (
            <>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Password saat ini"
                secureTextEntry
              />

              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Password baru"
                secureTextEntry
              />

              <TouchableOpacity style={styles.primaryButton} onPress={changePassword}>
                <Text style={styles.primaryText}>Ubah Password</Text>
              </TouchableOpacity>
            </>
          )}

          {activeSection === 'target' && user?.role === 'owner' && (
            <>
              <TextInput
                style={[styles.input, styles.lockedInput]}
                value={targetYear}
                editable={false}
                placeholder="Tahun"
              />

              <TextInput
                style={styles.input}
                value={annualTarget}
                onChangeText={setAnnualTarget}
                placeholder="Target penjualan tahunan"
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.primaryButton} onPress={saveTarget}>
                <Text style={styles.primaryText}>Simpan / Edit Target</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tabButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    color: '#111827',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
  },
  lockedInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});