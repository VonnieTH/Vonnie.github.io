// ============================================================
//  SUPABASE CONFIG
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://hfwywsfqwnlavhnmepyj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhmd3l3c2Zxd25sYXZobm1lcHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDY5OTYsImV4cCI6MjA5MDc4Mjk5Nn0.tzytS8S0EzA0RylSt3RM0Y36zxlQVU0KyxKstQlSPX8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
//  BADGE CATALOG
// ============================================================
export const BADGE_CATALOG = {
  early_tester: {
    id:    'early_tester',
    label: 'Early Tester',
    icon:  '🧪',
    color: '#9b6dff',
    desc:  'Joined during the early beta of VonnieStudio Community',
    tier:  'special',
  },
  member: {
    id:    'member',
    label: 'Member',
    icon:  '⚡',
    color: '#00d4ff',
    desc:  'Verified community member',
    tier:  'base',
  },
  first_message: {
    id:    'first_message',
    label: 'First Words',
    icon:  '💬',
    color: '#40ff80',
    desc:  'Sent your very first message in the community',
    tier:  'base',
  },
  chatter: {
    id:    'chatter',
    label: 'Chatter',
    icon:  '🗣️',
    color: '#ffd700',
    desc:  'Sent 10 messages',
    tier:  'silver',
  },
  veteran: {
    id:    'veteran',
    label: 'Veteran',
    icon:  '📢',
    color: '#ff8c00',
    desc:  'Sent 50 messages — true community regular',
    tier:  'gold',
  },
  image_sender: {
    id:    'image_sender',
    label: 'Shutterbug',
    icon:  '📸',
    color: '#ff6bff',
    desc:  'Shared your first image in the community',
    tier:  'base',
  },
};

// ============================================================
//  AUTH
// ============================================================
export async function signUp(email, password, username) {
  const { data: existing } = await supabase
    .from('profiles').select('id').eq('username', username).maybeSingle();
  if (existing) return { error: { message: 'This username is already in use' } };
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { username } }
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles').select('*').eq('id', userId).single();
  return { data, error };
}

// ============================================================
//  BADGES
// ============================================================
export async function getUserBadges(userId) {
  const { data, error } = await supabase
    .from('user_badges').select('badge_id, granted_at').eq('user_id', userId);
  return { data: data || [], error };
}

export async function grantBadge(userId, badgeId) {
  const { error } = await supabase
    .from('user_badges')
    .upsert({ user_id: userId, badge_id: badgeId }, { onConflict: 'user_id,badge_id' });
  return { error };
}

// Grant early_tester + member to everyone on every login (retroactive)
export async function ensureLoginBadges(userId) {
  await grantBadge(userId, 'member');
  await grantBadge(userId, 'early_tester');
}