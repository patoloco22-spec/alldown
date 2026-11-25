import { useState, useEffect, useCallback } from 'react';
import type { AllSettings } from '@shared/types';

export function useSettings() {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.settings.getAll();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (section: keyof AllSettings, updates: Partial<AllSettings[keyof AllSettings]>) => {
    if (!settings) return { success: false, error: 'Settings not loaded' };

    const result = await window.electronAPI.settings.update(section, updates);
    if (result.success) {
      setSettings(prev => prev ? { ...prev, [section]: { ...prev[section], ...updates } } : null);
    }
    return result;
  }, [settings]);

  const resetSettings = useCallback(async (section?: keyof AllSettings) => {
    const result = await window.electronAPI.settings.reset(section);
    if (result.success) {
      fetchSettings();
    }
    return result;
  }, [fetchSettings]);

  const exportSettings = useCallback(async () => {
    return window.electronAPI.settings.export();
  }, []);

  const importSettings = useCallback(async () => {
    const result = await window.electronAPI.settings.import();
    if (result.success) {
      fetchSettings();
    }
    return result;
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    refetch: fetchSettings,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
  };
}