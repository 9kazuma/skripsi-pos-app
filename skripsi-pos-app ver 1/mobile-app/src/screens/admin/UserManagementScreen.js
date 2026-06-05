import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../../components/ScreenContainer';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const emptyForm = {
  id: null,
  name: '',
  username: '',
  password: '',
  role: 'cashier',
  email: '',
  whatsapp: '',
};

function showMessage(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

function showConfirm(title, message, onConfirm) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Hapus', style: 'destructive', onPress: onConfirm },
  ]);
}

function getRoleLabel(role) {
  if (role === 'owner') return 'Owner/Admin';
  if (role === 'manager') return 'Manager';
  if (role === 'cashier') return 'Cashier';
  return role || '-';
}

export default function UserManagementScreen() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const isOwner = currentUser?.role === 'owner';
  const isManager = currentUser?.role === 'manager';

  const roleOptions = useMemo(() => {
    if (isOwner) return ['owner', 'manager', 'cashier'];
    return ['manager', 'cashier'];
  }, [isOwner]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');

      console.log('USERS RESPONSE:', response.data);

      const loadedUsers =
        response?.data?.data ||
        response?.data?.users ||
        response?.data ||
        [];

      setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
    } catch (error) {
      console.log('LOAD USERS ERROR:', error?.response?.data || error.message);
      showMessage(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa memuat user'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  const openCreate = () => {
    setForm({
      ...emptyForm,
      role: isOwner ? 'manager' : 'cashier',
    });
    setModalVisible(true);
  };

  const openEdit = (item) => {
    if (isManager && item.role === 'owner') {
      showMessage('Akses Ditolak', 'Manager tidak dapat mengubah akun owner');
      return;
    }

    setForm({
      id: item.id,
      name: item.name || '',
      username: item.username || '',
      password: '',
      role: item.role || 'cashier',
      email: item.email || '',
      whatsapp: item.whatsapp || '',
    });
    setModalVisible(true);
  };

  const saveUser = async () => {
    try {
      const normalizedRole = String(form.role || '').toLowerCase().trim();

      if (!form.name || !form.username || (!form.id && !form.password) || !normalizedRole) {
        showMessage('Validasi', 'Lengkapi data user');
        return;
      }

      if (!roleOptions.includes(normalizedRole)) {
        showMessage(
          'Akses Ditolak',
          isOwner
            ? 'Role harus owner, manager, atau cashier'
            : 'Manager hanya dapat membuat atau mengubah role manager/cashier'
        );
        return;
      }

      if (form.id) {
        await api.put(`/users/${form.id}`, {
          name: form.name,
          email: form.email,
          whatsapp: form.whatsapp,
          password: form.password,
          role: normalizedRole,
        });

        showMessage('Berhasil', 'User berhasil diupdate');
      } else {
        await api.post('/users', {
          name: form.name,
          username: form.username,
          password: form.password,
          role: normalizedRole,
          email: form.email,
          whatsapp: form.whatsapp,
        });

        showMessage('Berhasil', 'User berhasil ditambahkan');
      }

      setModalVisible(false);
      setForm(emptyForm);
      loadUsers();
    } catch (error) {
      showMessage(
        'Gagal',
        error?.response?.data?.message || 'Tidak bisa menyimpan user'
      );
    }
  };

  const deleteUser = async (item) => {
    if (isManager && item.role === 'owner') {
      showMessage('Akses Ditolak', 'Manager tidak dapat menghapus akun owner');
      return;
    }

    showConfirm('Konfirmasi', 'Yakin ingin menghapus user ini?', async () => {
      try {
        await api.delete(`/users/${item.id}`);
        showMessage('Berhasil', 'User berhasil dihapus');
        loadUsers();
      } catch (error) {
        showMessage(
          'Gagal',
          error?.response?.data?.message || 'Tidak bisa menghapus user'
        );
      }
    });
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Manajemen User</Text>
            <Text style={styles.subtitle}>
              Tambah, edit, dan hapus akun login
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryText}>+ Tambah User</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Daftar User {loading ? '(loading...)' : ''}
          </Text>

          {users.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada data user atau data gagal terbaca.</Text>
          ) : (
            users.map((item) => {
              const isProtectedOwner = isManager && item.role === 'owner';

              return (
                <View key={item.id} style={styles.userCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text>Username: {item.username}</Text>
                    <Text>Role: {getRoleLabel(item.role)}</Text>
                    <Text>Email: {item.email || '-'}</Text>
                    <Text>No Whatsapp: {item.whatsapp || '-'}</Text>
                    {isProtectedOwner && (
                      <Text style={styles.protectedText}>
                        Akun owner dilindungi dari perubahan manager
                      </Text>
                    )}
                  </View>

                  <View style={styles.actionColumn}>
                    <TouchableOpacity
                      style={[styles.editButton, isProtectedOwner && styles.disabledButton]}
                      onPress={() => openEdit(item)}
                    >
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.deleteButton, isProtectedOwner && styles.disabledButton]}
                      onPress={() => deleteUser(item)}
                    >
                      <Text style={styles.actionText}>Hapus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {form.id ? 'Edit User' : 'Tambah User'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                placeholder="Nama"
                value={form.name}
                onChangeText={(value) => setForm({ ...form, name: value })}
              />

              <TextInput
                style={[styles.input, form.id && styles.lockedInput]}
                placeholder="Username"
                value={form.username}
                editable={!form.id}
                onChangeText={(value) => setForm({ ...form, username: value })}
              />

              <Text style={styles.roleLabel}>Role</Text>
              <View style={styles.roleRow}>
                {roleOptions.map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      form.role === role && styles.roleButtonActive,
                    ]}
                    onPress={() => setForm({ ...form, role })}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        form.role === role && styles.roleButtonTextActive,
                      ]}
                    >
                      {getRoleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder={form.id ? 'Password baru (opsional)' : 'Password'}
                value={form.password}
                secureTextEntry
                onChangeText={(value) => setForm({ ...form, password: value })}
              />

              <TextInput
                style={styles.input}
                placeholder="Email"
                value={form.email}
                onChangeText={(value) => setForm({ ...form, email: value })}
              />

              <TextInput
                style={styles.input}
                placeholder="No Whatsapp"
                value={form.whatsapp}
                onChangeText={(value) => setForm({ ...form, whatsapp: value })}
              />

              <TouchableOpacity style={styles.primaryButtonFull} onPress={saveUser}>
                <Text style={styles.primaryText}>Simpan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButtonFull}
                onPress={() => {
                  setModalVisible(false);
                  setForm(emptyForm);
                }}
              >
                <Text style={styles.secondaryText}>Tutup</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    color: '#6b7280',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyText: {
    color: '#6b7280',
  },
  userCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  userName: {
    fontWeight: '700',
    fontSize: 16,
  },
  protectedText: {
    color: '#b45309',
    fontSize: 12,
    marginTop: 5,
  },
  actionColumn: {
    gap: 8,
    alignSelf: 'flex-start',
  },
  editButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.45,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primaryButtonFull: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButtonFull: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryText: {
    color: '#111827',
    fontWeight: '700',
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  lockedInput: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
  },
  roleLabel: {
    color: '#111827',
    fontWeight: '700',
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  roleButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  roleButtonActive: {
    backgroundColor: '#2563eb',
  },
  roleButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
});
