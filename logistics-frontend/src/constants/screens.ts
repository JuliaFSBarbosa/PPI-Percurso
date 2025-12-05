export const SCREEN_IDS = ["inicio", "rotas", "pedidos", "produtos", "usuarios"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export type AppScreen = {
  id: ScreenId;
  label: string;
  path: string;
  matches: string[];
};

export const APP_SCREENS: AppScreen[] = [
  {
    id: "inicio",
    label: "Início",
    path: "/inicio",
    matches: ["/inicio", "/inicio/padrao"],
  },
  {
    id: "rotas",
    label: "Rotas",
    path: "/rotas",
    matches: ["/rotas"],
  },
  {
    id: "pedidos",
    label: "Pedidos",
    path: "/pedidos",
    matches: ["/pedidos", "/entregas"],
  },
  {
    id: "produtos",
    label: "Produtos",
    path: "/produtos",
    matches: ["/produtos"],
  },
  {
    id: "usuarios",
    label: "Usuários",
    path: "/configuracoes",
    matches: ["/configuracoes"],
  },
];

export const DEFAULT_SCREEN_IDS: ScreenId[] = ["inicio", "rotas"];

export const findScreenByPath = (pathname: string): AppScreen | undefined => {
  const normalized = pathname.toLowerCase();
  return APP_SCREENS.find((screen) =>
    screen.matches.some(
      (match) => normalized === match || normalized.startsWith(`${match}/`)
    )
  );
};
