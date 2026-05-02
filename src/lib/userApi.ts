import { invoke } from "@tauri-apps/api/core";

export type LocalUser = {
  id: number;
  name: string;
  email: string;
};

export async function createLocalUser(name: string, email: string) {
  return invoke<LocalUser>("create_user", {
    payload: { name, email },
  });
}

export async function listLocalUsers() {
  return invoke<LocalUser[]>("list_users");
}

export async function updateLocalUser(id: number, name: string, email: string) {
  return invoke<LocalUser>("update_user", {
    payload: { id, name, email },
  });
}

export async function deleteLocalUser(id: number) {
  return invoke<void>("delete_user", { id });
}

