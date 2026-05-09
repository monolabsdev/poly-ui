import { useOllamaStore } from "./monitor";
import { useShallow } from "zustand/react/shallow";
import { ollamaClient } from "./client";

export function useOllama() {
  const store = useOllamaStore(
    useShallow((state) => ({
      state: state.state,
      models: state.models,
      error: state.error,
      pullingModel: state.pullingModel,
      pullProgress: state.pullProgress,
    }))
  );

  const actions = useOllamaStore((state) => state.actions);

  return {
    ...store,
    actions,
    online: store.state === "online",
    refresh: actions.refresh,
    cancelPull: ollamaClient.cancelPull,
    deleteModel: ollamaClient.deleteModel,
  };
}
