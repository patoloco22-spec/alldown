import { useEffect, useCallback, useState } from 'react';

export function useClipboard() {
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const startMonitoring = useCallback(() => {
    window.electronAPI.clipboard.start();
  }, []);

  const stopMonitoring = useCallback(() => {
    window.electronAPI.clipboard.stop();
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI.clipboard.onUrlDetected((url) => {
      setLastUrl(url);
    });

    return unsubscribe;
  }, []);

  return {
    lastUrl,
    startMonitoring,
    stopMonitoring,
    clearLastUrl: () => setLastUrl(null),
  };
}