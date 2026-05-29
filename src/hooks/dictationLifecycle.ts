interface MutableBooleanRef {
  current: boolean;
}

export function markDictationMounted(isMountedRef: MutableBooleanRef): () => void {
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
  };
}
