import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recent_searches';
const LIMIT = 5;

export const getRecentSearches = async (): Promise<string[]> => {
  try {
    const data = await AsyncStorage.getItem(KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting recent searches:', error);
    return [];
  }
};

export const addRecentSearch = async (query: string): Promise<string[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  try {
    const existing = await getRecentSearches();
    const updated = [
      trimmedQuery,
      ...existing.filter(q => q.toLowerCase() !== trimmedQuery.toLowerCase()),
    ].slice(0, LIMIT);

    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.error('Error adding recent search:', error);
    return [];
  }
};

export const clearRecentSearches = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch (error) {
    console.error('Error clearing recent searches:', error);
  }
};
