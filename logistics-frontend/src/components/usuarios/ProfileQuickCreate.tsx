"use client";

import { useEffect, useState } from "react";
import styles from "@/app/inicio/styles.module.css";
import { ScreenId } from "@/constants/screens";
import { fetchProfileScreens, saveProfile, ScreenDefinitionDTO } from "@/lib/profile-client";

type Props = {
  onCreated: (profile: UserProfile) => void;
};

export function ProfileQuickCreate({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<ScreenId[]>([]);
  const [featurePermissions, setFeaturePermissions] = useState<Partial<Record<ScreenId, string[]>>>({});
  const [screens, setScreens] = useState<ScreenDefinitionDTO[]>([]);
  const [loadingScreens, setLoadingScreens] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadScreens = async () => {
      setLoadingScreens(true);
      setError(null);
      try {
        const data = await fetchProfileScreens();
        if (active) setScreens(data);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Falha ao carregar telas disponíveis.");
        }
      } finally {
        if (active) setLoadingScreens(false);
      }
    };
    loadScreens();
    return () => {
      active = false;
    };
  }, [open]);

  const togglePermission = (screenId: ScreenId) => {
    setPermissions((prev) => {
      const exists = prev.includes(screenId);
      if (exists) {
        setFeaturePermissions((current) => {
          const next = { ...current };
          delete next[screenId];
          return next;
        });
      }
      return exists ? prev.filter((permission) => permission !== screenId) : [...prev, screenId];
    });
  };

  const toggleFeature = (screenId: ScreenId, featureId: string) => {
    setFeaturePermissions((prev) => {
      const current = prev[screenId] ?? [];
      const exists = current.includes(featureId);
      const nextFeatures = exists
        ? current.filter((feature) => feature !== featureId)
        : [...current, featureId];
      const next = { ...prev };
      if (nextFeatures.length) {
        next[screenId] = nextFeatures;
      } else {
        delete next[screenId];
      }
      return next;
    });
    setPermissions((prev) => (prev.includes(screenId) ? prev : [...prev, screenId]));
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do perfil.");
      return;
    }
    setSaving(true);
    try {
      const created = await saveProfile({
        name: name.trim(),
        permissions,
        feature_permissions: featurePermissions,
      });
      onCreated(created);
      setName("");
      setPermissions([]);
      setFeaturePermissions({});
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.quickProfile}>
      <button
        type="button"
        className={`${styles.btn} ${styles.ghost} ${styles.sm}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? "Cancelar novo perfil" : "Criar novo perfil"}
      </button>
      {open && (
        <div className={`${styles.card} ${styles.quickProfileCard}`}>
          <div className={styles.field}>
            <label htmlFor="quick-name">Nome</label>
            <input
              id="quick-name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label>Telas liberadas</label>
            {loadingScreens && <p className={styles.muted}>Carregando telas permitidas...</p>}
            {!loadingScreens && screens.length === 0 && (
              <p className={styles.muted}>Nenhuma tela disponível.</p>
            )}
            {!loadingScreens && screens.length > 0 && (
              <div className={styles.cards3}>
                {screens.map((screen) => (
                  <div key={screen.id} className={styles.permissionGroup}>
                    <label className={styles.inlineField}>
                      <input
                        type="checkbox"
                        checked={permissions.includes(screen.id)}
                        onChange={() => togglePermission(screen.id)}
                      />
                      {screen.label}
                    </label>
                    {!!screen.features?.length && (
                      <div className={styles.featureList}>
                        {screen.features.map((feature) => (
                          <label key={`${screen.id}-${feature.id}`} className={styles.featureItem}>
                            <input
                              type="checkbox"
                              checked={featurePermissions[screen.id]?.includes(feature.id) ?? false}
                              onChange={() => toggleFeature(screen.id, feature.id)}
                            />
                            {feature.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <p className={styles.muted}>{error}</p>}
          <button
            type="button"
            className={`${styles.btn} ${styles.primary} ${styles.quickProfileSave}`}
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      )}
    </div>
  );
}
