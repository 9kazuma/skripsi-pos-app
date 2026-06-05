import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

export default function ScreenContainer({ children, scroll = true }) {
  const Wrapper = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safeArea}>
      <Wrapper contentContainerStyle={styles.content} style={styles.wrapper}>
        {children}
      </Wrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fb' },
  wrapper: { flex: 1 },
  content: { padding: 16, gap: 14 },
});
