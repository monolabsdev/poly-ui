import type { ProviderType } from "@/features/providers";

export type OllamaState = "online" | "offline" | "reconnecting" | "loading";

export type OllamaModel = {
  name: string;
  families: string[];
  size: number;
  supports_vision?: boolean;
  provider_type: ProviderType;
  provider_config_id?: number;
};

export type PullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
};
