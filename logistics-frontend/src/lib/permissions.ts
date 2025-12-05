import { APP_SCREENS, ScreenId, SCREEN_IDS, findScreenByPath } from "@/constants/screens";

export const normalizePermissions = (permissions?: string[] | null) => {
  if (!Array.isArray(permissions)) return [] as ScreenId[];
  return permissions.filter((item): item is ScreenId => SCREEN_IDS.includes(item as ScreenId));
};

export const canAccessScreen = (permissions: ScreenId[], screenId?: ScreenId | null) => {
  if (!screenId) return true;
  return permissions.includes(screenId);
};

export const screensAllowedFor = (permissions: ScreenId[]) => {
  if (!permissions.length) return [] as ScreenId[];
  return APP_SCREENS.filter((screen) => permissions.includes(screen.id)).map((screen) => screen.id);
};

export const findScreenIdByPath = (pathname: string): ScreenId | null => {
  const screen = findScreenByPath(pathname);
  return screen?.id ?? null;
};

export const filterScreensByPermissions = (permissions: ScreenId[]) =>
  APP_SCREENS.filter((screen) => permissions.includes(screen.id));

export const firstAllowedScreen = (permissions: ScreenId[]) =>
  APP_SCREENS.find((screen) => permissions.includes(screen.id));

export const firstAllowedPath = (permissions: ScreenId[]) =>
  firstAllowedScreen(permissions)?.path ?? "/inicio";
