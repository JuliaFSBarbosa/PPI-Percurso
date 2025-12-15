"use client";

import { useState } from "react";
import styles from "@/app/inicio/styles.module.css";
import { APP_SCREENS, ScreenId } from "@/constants/screens";
import { saveProfile } from "@/lib/profile-client";

type Props = {
  onCreated: (profile: UserProfile) => void;
};

export function ProfileQuickCreate({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<ScreenId[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePermission = (screenId: ScreenId) => {
    setPermissions((prev) =>
      prev.includes(screenId) ? prev.filter((permission) => permission !== screenId) : [...prev, screenId]
    );
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome do perfil.");
      return;
    }
    setSaving(true);
    try {
      const created = await saveProfile({ name: name.trim(), permissions });
      onCreated(created);
      setName("");
      setPermissions([]);
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
            <div className={styles.cards3}>
              {APP_SCREENS.map((screen) => (
                <label key={screen.id} className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(screen.id)}
                    onChange={() => togglePermission(screen.id)}
                  />
                  {screen.label}
                </label>
              ))}
            </div>
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
