"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import styles from "@/app/inicio/styles.module.css";
import { APP_SCREENS, ScreenId } from "@/constants/screens";
import { normalizePermissions } from "@/lib/permissions";

type Props = {
  active?: ScreenId;
};

export function AppSidebar({ active }: Props) {
  const { data: session } = useSession();
  const permissions = session?.user?.is_superuser
    ? APP_SCREENS.map((screen) => screen.id)
    : normalizePermissions(session?.user?.permissions);
  const isDefaultProfile = !!session?.user?.profile?.is_default;

  const allowedScreens = APP_SCREENS.filter((screen) => permissions.includes(screen.id));

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <img src="/caminhao.png" alt="Logomarca Caminhão" />
      </div>
      <nav>
        {allowedScreens.map((screen) => {
          const href = screen.id === "inicio" && isDefaultProfile ? "/inicio/padrao" : screen.path;
          return (
            <Link
              key={screen.id}
              href={href}
              className={active === screen.id ? styles.active : undefined}
              aria-current={active === screen.id ? "page" : undefined}
            >
              {screen.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
