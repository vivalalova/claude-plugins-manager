import { useCallback } from 'react';
import type React from 'react';

interface UseSectionDropOptions {
  sectionId: number | 'new';
  draggedMarketplace: string | null;
  setDragOverSectionId: React.Dispatch<React.SetStateAction<number | 'new' | null>>;
  setDraggedMarketplace: React.Dispatch<React.SetStateAction<string | null>>;
  onDrop: (marketplace: string) => void;
}

interface SectionDropHandlers {
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function useSectionDrop({
  sectionId,
  draggedMarketplace,
  setDragOverSectionId,
  setDraggedMarketplace,
  onDrop,
}: UseSectionDropOptions): SectionDropHandlers {
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (draggedMarketplace) {
        e.preventDefault();
        setDragOverSectionId(sectionId);
      }
    },
    [draggedMarketplace, sectionId, setDragOverSectionId]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverSectionId(null);
      }
    },
    [setDragOverSectionId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const mp = e.dataTransfer.getData('text/plain');
      if (mp) {
        e.preventDefault();
        onDrop(mp);
      }
      setDragOverSectionId(null);
      setDraggedMarketplace(null);
    },
    [onDrop, setDragOverSectionId, setDraggedMarketplace]
  );

  return {
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };
}
