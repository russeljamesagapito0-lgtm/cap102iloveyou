// src/utils/chatStore.js
// Supabase-backed chat history for the RootCare Companion chatbot.
// One row in `chats` per conversation; rows in `chat_messages` for each turn.
import { supabase } from './supabaseClient';

const TITLE_MAX = 40;

const fallbackTitle = (rawTitle) => {
  if (!rawTitle) return 'New Chat';
  const trimmed = rawTitle.trim();
  if (!trimmed) return 'New Chat';
  return trimmed.length > TITLE_MAX
    ? trimmed.slice(0, TITLE_MAX - 1) + '…'
    : trimmed;
};

const rowToMessage = (row) => ({
  id: row.id,
  chatId: row.chat_id,
  text: row.text || '',
  sender: row.sender,
  image: row.image_path || null,
  isError: !!row.is_error,
  createdAt: row.created_at,
});

const rowToChat = (row) => ({
  id: row.id,
  title: row.title || 'New Chat',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const loadChats = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return [];

    const { data, error } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('loadChats failed:', error.message);
      return [];
    }
    return (data || []).map(rowToChat);
  } catch (e) {
    console.warn('loadChats error:', e?.message);
    return [];
  }
};

export const loadMessages = async (chatId) => {
  if (!chatId) return [];
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, chat_id, sender, text, image_path, is_error, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('loadMessages failed:', error.message);
      return [];
    }
    return (data || []).map(rowToMessage);
  } catch (e) {
    console.warn('loadMessages error:', e?.message);
    return [];
  }
};

export const createChat = async (title = 'New Chat') => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: session.user.id,
        title: fallbackTitle(title),
      })
      .select('id, title, created_at, updated_at')
      .single();

    if (error) {
      console.warn('createChat failed:', error.message);
      return null;
    }
    return rowToChat(data);
  } catch (e) {
    console.warn('createChat error:', e?.message);
    return null;
  }
};

export const appendMessage = async (chatId, { sender, text, image = null, isError = false }) => {
  if (!chatId) return null;
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        sender,
        text: text || '',
        image_path: image,
        is_error: !!isError,
      })
      .select('id, chat_id, sender, text, image_path, is_error, created_at')
      .single();

    if (error) {
      console.warn('appendMessage failed:', error.message);
      return null;
    }
    return rowToMessage(data);
  } catch (e) {
    console.warn('appendMessage error:', e?.message);
    return null;
  }
};

export const renameChat = async (chatId, title) => {
  if (!chatId) return false;
  const { error } = await supabase
    .from('chats')
    .update({ title: fallbackTitle(title), updated_at: new Date().toISOString() })
    .eq('id', chatId);
  if (error) {
    console.warn('renameChat failed:', error.message);
    return false;
  }
  return true;
};

export const deleteChat = async (chatId) => {
  if (!chatId) return false;
  const { error } = await supabase.from('chats').delete().eq('id', chatId);
  if (error) {
    console.warn('deleteChat failed:', error.message);
    return false;
  }
  return true;
};

export const deriveTitleFromFirstUserMessage = (messages) => {
  const first = (messages || []).find((m) => m.sender === 'user' && m.text?.trim());
  return fallbackTitle(first?.text);
};