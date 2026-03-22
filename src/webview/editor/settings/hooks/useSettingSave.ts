import { useState } from 'react';
import { useToast } from '../../../components/Toast';

/**
 * Encapsulates the common saving pattern: setSaving(true) → try → catch(addToast) → finally(setSaving(false)).
 * Returns `saving` state and a `withSave` wrapper.
 */
export function useSettingSave(): {
  saving: boolean;
  withSave: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
} {
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const withSave = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSaving(true);
    try {
      return await fn();
    } catch (e) {
      addToast(e instanceof Error ? e.message : String(e), 'error');
      return undefined;
    } finally {
      setSaving(false);
    }
  };

  return { saving, withSave };
}
