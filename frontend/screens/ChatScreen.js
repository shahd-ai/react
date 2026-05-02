import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { chat } from '../api';

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      id:   '0',
      role: 'assistant',
      text: 'Bonjour ! Je suis votre expert en irrigation agricole. Posez-moi vos questions sur vos cultures en Tunisie.',
    }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const flatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages.map(m => ({
        role:    m.role === 'assistant' ? 'assistant' : 'user',
        content: m.text,
      }));

      const response = await chat(history);
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: response }
      ]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', text: 'Erreur de connexion. Vérifiez que le serveur est démarré.' }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = ({ item }) => (
    <View style={[styles.msgRow, item.role === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
      {item.role === 'assistant' && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🌿</Text>
        </View>
      )}
      <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.bubbleText, item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color="#27ae60" />
          <Text style={styles.typingText}>L'expert réfléchit...</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Posez votre question..."
          multiline
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={loading}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f5f6fa' },
  list:            { padding: 16, paddingBottom: 8 },
  msgRow:          { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowUser:      { justifyContent: 'flex-end' },
  msgRowBot:       { justifyContent: 'flex-start' },
  avatar:          { width: 36, height: 36, borderRadius: 18, backgroundColor: '#d5f5e3',
                     justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  avatarText:      { fontSize: 18 },
  bubble:          { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleUser:      { backgroundColor: '#27ae60', borderBottomRightRadius: 4 },
  bubbleBot:       { backgroundColor: '#fff', borderBottomLeftRadius: 4,
                     shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  bubbleText:      { fontSize: 15, lineHeight: 22 },
  bubbleTextUser:  { color: '#fff' },
  bubbleTextBot:   { color: '#2c3e50' },
  typing:          { flexDirection: 'row', alignItems: 'center', padding: 8, paddingLeft: 16 },
  typingText:      { marginLeft: 8, color: '#7f8c8d', fontSize: 13 },
  inputRow:        { flexDirection: 'row', padding: 12, backgroundColor: '#fff',
                     borderTopWidth: 1, borderTopColor: '#dfe6e9', alignItems: 'flex-end' },
  input:           { flex: 1, backgroundColor: '#f5f6fa', borderRadius: 20, paddingHorizontal: 16,
                     paddingVertical: 10, fontSize: 15, maxHeight: 100, marginRight: 8 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#27ae60',
                     justifyContent: 'center', alignItems: 'center' },
  sendIcon:        { color: '#fff', fontSize: 18 },
});
