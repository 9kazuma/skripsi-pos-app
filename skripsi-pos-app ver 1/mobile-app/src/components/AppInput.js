import React from 'react';
import { TextInput, StyleSheet } from 'react-native';

export default function AppInput(props) {
  return <TextInput style={styles.input} placeholderTextColor="#999" {...props} />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    color: '#fff',
    backgroundColor: '#111',
  },
});