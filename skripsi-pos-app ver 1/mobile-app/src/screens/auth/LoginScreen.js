import React, { useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppInput from '../../components/AppInput';
import AppButton from '../../components/AppButton';
import { loginRequest } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Validation', 'Username and password are required');
      return;
    }

    try {
      setLoading(true);

      const result = await loginRequest({ username, password });
      console.log('LOGIN RESULT:', result);

      const token = result?.data?.token ?? result?.token;
      const user = result?.data?.user ?? result?.user;

      if (!token || !user) {
        Alert.alert('Login Failed', 'Invalid response from server');
        return;
      }

      login(user, token);
    } catch (error) {
      console.log('LOGIN ERROR:', error?.response?.data || error.message);

      Alert.alert(
        'Login Failed',
        error?.response?.data?.message || 'Username or password is incorrect'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <Image
           source={require('../../../assets/invoxa-logo.png')}
           style={styles.logo}
           resizeMode="contain"
        />
      </View>

      <View style={styles.formWrapper}>
        <Text style={styles.title}>Selamat datang Kembali!</Text>
        <Text style={styles.subtitle}>Silahkan masuk untuk melanjutkan</Text>

        <Text style={styles.label}>Email/Username</Text>
        <AppInput
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <AppInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <View style={styles.buttonWrapper}>
          <AppButton
            title={loading ? 'Loading...' : 'Login'}
            onPress={handleLogin}
            disabled={loading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 26,
  },

  logoWrapper: {
    alignItems: 'center',
    marginTop: 72,
  },

  logo: {
    width: 305,
    height: 95,
  },

  formWrapper: {
    marginTop: 120,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 13,
    color: '#777777',
    textAlign: 'center',
    marginBottom: 32,
  },

  label: {
    fontSize: 13,
    color: '#666666',
    marginLeft: 7,
    marginBottom: 6,
  },

  buttonWrapper: {
    width: 156,
    alignSelf: 'center',
    marginTop: 62,
  },
});