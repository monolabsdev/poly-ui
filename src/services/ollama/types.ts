export type OllamaState = "online" | "offline" | "reconnecting" | "loading";

export type OllamaModel = {
  name: string;
  families: string[];
  size: number;
  supports_vision?: boolean;
};

export type PullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
};
