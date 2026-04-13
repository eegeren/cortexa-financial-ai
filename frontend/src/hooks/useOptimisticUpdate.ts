import { useCallback, useRef, useState } from 'react';

const useOptimisticUpdate = <T,>(initialValue: T) => {
  const [value, setValue] = useState(initialValue);
  const previousRef = useRef(initialValue);

  const applyOptimistic = useCallback((nextValue: T) => {
    previousRef.current = value;
    setValue(nextValue);
  }, [value]);

  const confirm = useCallback((nextValue?: T) => {
    if (nextValue !== undefined) {
      previousRef.current = nextValue;
      setValue(nextValue);
      return;
    }
    previousRef.current = value;
  }, [value]);

  const rollback = useCallback(() => {
    setValue(previousRef.current);
  }, []);

  const reset = useCallback((nextValue: T) => {
    previousRef.current = nextValue;
    setValue(nextValue);
  }, []);

  return {
    value,
    setValue,
    applyOptimistic,
    confirm,
    rollback,
    reset,
  };
};

export default useOptimisticUpdate;
