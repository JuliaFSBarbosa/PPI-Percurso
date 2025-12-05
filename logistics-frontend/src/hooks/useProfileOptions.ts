"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProfiles } from "@/lib/profile-client";

export const useProfileOptions = () => {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfiles();
      setProfiles(data);
    } catch (err) {
      setProfiles([]);
      setError(err instanceof Error ? err.message : "Falha ao carregar perfis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const addProfile = (profile: UserProfile) => {
    setProfiles((prev) => {
      if (prev.some((item) => item.id === profile.id)) return prev;
      return [...prev, profile].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  return { profiles, loading, error, reload: loadProfiles, addProfile };
};
