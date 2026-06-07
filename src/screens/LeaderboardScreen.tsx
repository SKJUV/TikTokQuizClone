import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getDatabase, ref, onValue } from '@react-native-firebase/database';

type UserEntry = { uid: string; score: number; displayName?: string };

export default function LeaderboardScreen(): React.JSX.Element {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getDatabase(getApp());
    const reference = ref(db, '/users');
    const unsubscribe = onValue(reference, (snap) => {
      const val = snap.val() || {};
      const list: UserEntry[] = Object.keys(val).map((k) => ({ uid: k, score: val[k].score || 0, displayName: val[k].displayName }));
      list.sort((a, b) => b.score - a.score);
      setUsers(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#fe2c55" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>Classement — Leaderboard</Text>
      <FlatList
        data={users}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => (
          <View style={styles.ligne}>
            <Text style={styles.position}>{index + 1}</Text>
            <View style={styles.info}>
              <Text style={styles.nom}>{item.displayName || item.uid}</Text>
              <Text style={styles.score}>{item.score} pts</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  centre: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  titre: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#111' },
  position: { color: '#fe2c55', fontSize: 18, width: 36, textAlign: 'center', fontWeight: '700' },
  info: { marginLeft: 12 },
  nom: { color: '#fff', fontSize: 16, fontWeight: '600' },
  score: { color: '#aaa', fontSize: 13 },
});
