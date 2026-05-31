import type { ProviderType } from "@/services/providers";

export type OllamaState = "online" | "offline" | "reconnecting" | "loading";

export type OllamaModel = {
  name: string;
  families: string[];
  size: number;
  supports_vision?: boolean;
  provider_type: ProviderType;
};

export type PullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
};
