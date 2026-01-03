import { ScreenId } from "@/constants/screens";
import { parseApiError } from "@/lib/apiError";

export type ScreenFeatureDefinitionDTO = {
  id: string;
  label: string;
};

export type ScreenDefinitionDTO = {
  id: ScreenId;
  label: string;
  routes: string[];
  features?: ScreenFeatureDefinitionDTO[];
};

export const fetchProfiles = async (): Promise<UserProfile[]> => {
  const resp = await fetch("/api/proxy/perfis", { cache: "no-store", credentials: "include" });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(parseApiError(text, "Falha ao carregar perfis.", resp.status));
  }
  const parsed = text ? JSON.parse(text) : [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.data)) return parsed.data;
  return [];
};

export const fetchProfileById = async (profileId: string | number): Promise<UserProfile> => {
  const resp = await fetch(`/api/proxy/perfis/${profileId}`, { cache: "no-store", credentials: "include" });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(parseApiError(text, "Falha ao carregar perfil.", resp.status));
  }
  const parsed = text ? JSON.parse(text) : null;
  return parsed && parsed.data ? (parsed.data as UserProfile) : parsed;
};

export const fetchProfileScreens = async (): Promise<ScreenDefinitionDTO[]> => {
  const resp = await fetch("/api/proxy/perfis/telas", { cache: "no-store", credentials: "include" });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(parseApiError(text, "Falha ao carregar telas disponíveis.", resp.status));
  }
  const parsed = text ? JSON.parse(text) : null;
  if (Array.isArray(parsed)) return parsed as ScreenDefinitionDTO[];
  if (Array.isArray(parsed?.screens)) return parsed.screens as ScreenDefinitionDTO[];
  if (Array.isArray(parsed?.data)) return parsed.data as ScreenDefinitionDTO[];
  if (Array.isArray(parsed?.data?.screens)) return parsed.data.screens as ScreenDefinitionDTO[];
  return [];
};

export const saveProfile = async (
  payload: { name: string; permissions: ScreenId[]; feature_permissions?: Partial<Record<ScreenId, string[]>> },
  profileId?: number
) => {
  const endpoint = profileId ? `/api/proxy/perfis/${profileId}` : "/api/proxy/perfis";
  const method = profileId ? "PUT" : "POST";
  const resp = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(
      parseApiError(text, profileId ? "Falha ao atualizar perfil." : "Falha ao criar perfil.", resp.status)
    );
  }
  const parsed = text ? JSON.parse(text) : null;
  return parsed && parsed.data ? (parsed.data as UserProfile) : parsed;
};

export const deleteProfile = async (profileId: number) => {
  const resp = await fetch(`/api/proxy/perfis/${profileId}`, {
    method: "DELETE",
    credentials: "include",
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(parseApiError(text, "Falha ao remover perfil.", resp.status));
  }
  return text ? JSON.parse(text) : { detail: "Perfil removido." };
};
