/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../../../vscode', () => ({}));

import { useSectionDrop } from '../useSectionDrop';

function makeDragEvent(overrides: {
  getDataReturn?: string;
  currentTargetContains?: boolean;
  relatedTarget?: Node | null;
} = {}): React.DragEvent {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      getData: vi.fn(() => overrides.getDataReturn ?? ''),
    },
    currentTarget: {
      contains: vi.fn(() => overrides.currentTargetContains ?? false),
    },
    relatedTarget: overrides.relatedTarget ?? null,
  } as unknown as React.DragEvent;
}

describe('useSectionDrop', () => {
  it('onDragOver: preventDefault + sets sectionId when draggedMarketplace is non-null', () => {
    const setDragOverSectionId = vi.fn();
    const setDraggedMarketplace = vi.fn();
    const onDrop = vi.fn();

    const { result } = renderHook(() =>
      useSectionDrop({
        sectionId: 0,
        draggedMarketplace: 'some-marketplace',
        setDragOverSectionId,
        setDraggedMarketplace,
        onDrop,
      })
    );

    const e = makeDragEvent();
    act(() => {
      result.current.onDragOver(e);
    });

    expect(e.preventDefault).toHaveBeenCalled();
    expect(setDragOverSectionId).toHaveBeenCalledWith(0);
  });

  it('onDragOver: does nothing when draggedMarketplace is null', () => {
    const setDragOverSectionId = vi.fn();
    const setDraggedMarketplace = vi.fn();
    const onDrop = vi.fn();

    const { result } = renderHook(() =>
      useSectionDrop({
        sectionId: 0,
        draggedMarketplace: null,
        setDragOverSectionId,
        setDraggedMarketplace,
        onDrop,
      })
    );

    const e = makeDragEvent();
    act(() => {
      result.current.onDragOver(e);
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(setDragOverSectionId).not.toHaveBeenCalled();
  });

  it('onDragLeave: clears dragOverSectionId when relatedTarget leaves currentTarget', () => {
    const setDragOverSectionId = vi.fn();
    const setDraggedMarketplace = vi.fn();
    const onDrop = vi.fn();

    const { result } = renderHook(() =>
      useSectionDrop({
        sectionId: 2,
        draggedMarketplace: 'mp',
        setDragOverSectionId,
        setDraggedMarketplace,
        onDrop,
      })
    );

    const e = makeDragEvent({ currentTargetContains: false, relatedTarget: document.createElement('div') });
    act(() => {
      result.current.onDragLeave(e);
    });

    expect(setDragOverSectionId).toHaveBeenCalledWith(null);
  });

  it('onDragLeave: does NOT clear when relatedTarget is still inside currentTarget', () => {
    const setDragOverSectionId = vi.fn();
    const setDraggedMarketplace = vi.fn();
    const onDrop = vi.fn();

    const { result } = renderHook(() =>
      useSectionDrop({
        sectionId: 2,
        draggedMarketplace: 'mp',
        setDragOverSectionId,
        setDraggedMarketplace,
        onDrop,
      })
    );

    const e = makeDragEvent({ currentTargetContains: true, relatedTarget: document.createElement('span') });
    act(() => {
      result.current.onDragLeave(e);
    });

    expect(setDragOverSectionId).not.toHaveBeenCalled();
  });

  it('onDrop: reads text/plain, calls onDrop callback, resets both states', () => {
    const setDragOverSectionId = vi.fn();
    const setDraggedMarketplace = vi.fn();
    const onDropCallback = vi.fn();

    const { result } = renderHook(() =>
      useSectionDrop({
        sectionId: 'new',
        draggedMarketplace: 'my-mp',
        setDragOverSectionId,
        setDraggedMarketplace,
        onDrop: onDropCallback,
      })
    );

    const e = makeDragEvent({ getDataReturn: 'my-mp' });
    act(() => {
      result.current.onDrop(e);
    });

    expect(e.dataTransfer.getData).toHaveBeenCalledWith('text/plain');
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onDropCallback).toHaveBeenCalledWith('my-mp');
    expect(setDragOverSectionId).toHaveBeenCalledWith(null);
    expect(setDraggedMarketplace).toHaveBeenCalledWith(null);
  });

  it('onDrop: empty dataTransfer still resets states but does NOT call callback', () => {
    const setDragOverSectionId = vi.fn();
    const setDraggedMarketplace = vi.fn();
    const onDropCallback = vi.fn();

    const { result } = renderHook(() =>
      useSectionDrop({
        sectionId: 1,
        draggedMarketplace: null,
        setDragOverSectionId,
        setDraggedMarketplace,
        onDrop: onDropCallback,
      })
    );

    const e = makeDragEvent({ getDataReturn: '' });
    act(() => {
      result.current.onDrop(e);
    });

    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(onDropCallback).not.toHaveBeenCalled();
    expect(setDragOverSectionId).toHaveBeenCalledWith(null);
    expect(setDraggedMarketplace).toHaveBeenCalledWith(null);
  });
});
