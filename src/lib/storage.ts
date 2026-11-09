/** Thin localStorage wrapper mirroring AsyncStorage's async API. */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore quota / private mode
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
  async multiRemove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => storage.removeItem(k)));
  },
};
