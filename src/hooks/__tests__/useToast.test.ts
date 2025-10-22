import { renderHook, act } from '@testing-library/react';
import { useToast } from '../useToast';

describe('useToast', () => {
  it('should initialize with empty toasts', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
  });

  it('should add a success toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Operation successful');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'success',
      message: 'Operation successful',
    });
    expect(result.current.toasts[0].id).toBeDefined();
  });

  it('should add an error toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.error('Operation failed');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'error',
      message: 'Operation failed',
    });
  });

  it('should add an info toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.info('Information message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'info',
      message: 'Information message',
    });
  });

  it('should add a warning toast', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.warning('Warning message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      type: 'warning',
      message: 'Warning message',
    });
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Success 1');
      result.current.error('Error 1');
      result.current.info('Info 1');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe('Success 1');
    expect(result.current.toasts[1].message).toBe('Error 1');
    expect(result.current.toasts[2].message).toBe('Info 1');
  });

  it('should remove a toast by id', () => {
    const { result } = renderHook(() => useToast());

    let toastId: string;
    act(() => {
      toastId = result.current.success('Test toast');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should support custom duration', () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      result.current.success('Custom duration', 5000);
    });

    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('should generate unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());

    const ids: string[] = [];
    act(() => {
      ids.push(result.current.success('Toast 1'));
      ids.push(result.current.success('Toast 2'));
      ids.push(result.current.success('Toast 3'));
    });

    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it('should only remove the specified toast', () => {
    const { result } = renderHook(() => useToast());

    let id1: string, id2: string, id3: string;
    act(() => {
      id1 = result.current.success('Toast 1');
      id2 = result.current.error('Toast 2');
      id3 = result.current.info('Toast 3');
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.removeToast(id2);
    });

    expect(result.current.toasts).toHaveLength(2);
    expect(result.current.toasts.find(t => t.id === id1)).toBeDefined();
    expect(result.current.toasts.find(t => t.id === id2)).toBeUndefined();
    expect(result.current.toasts.find(t => t.id === id3)).toBeDefined();
  });
});
