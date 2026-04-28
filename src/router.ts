export type AppRoute = "game" | "settings";

type RouteListener = (route: AppRoute) => void;

const ROUTE_SEARCH_PARAM = "p";
const QUERY_SEARCH_PARAM = "q";
const HASH_SEARCH_PARAM = "h";
const listeners = new Set<RouteListener>();

function normalizeBasePath(baseUrl: string): string {
  const url = new URL(baseUrl, window.location.origin);
  const pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  return pathname || "";
}

function getBasePath(): string {
  return normalizeBasePath(import.meta.env.BASE_URL);
}

function trimTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function stripBasePath(pathname: string): string {
  const normalizedBase = getBasePath();
  const normalizedPath = trimTrailingSlash(pathname);

  if (!normalizedBase) {
    return normalizedPath || "/";
  }

  if (normalizedPath === normalizedBase) {
    return "/";
  }

  if (normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath.slice(normalizedBase.length) || "/";
  }

  return normalizedPath || "/";
}

function routeFromPath(pathname: string): AppRoute {
  const appPath = trimTrailingSlash(stripBasePath(pathname));
  return appPath === "/settings" ? "settings" : "game";
}

function pathForRoute(route: AppRoute): string {
  const basePath = getBasePath();
  const routePath = route === "settings" ? "/settings" : "";
  return `${basePath}${routePath}` || "/";
}

function restorePathFromSpaFallback(): void {
  const url = new URL(window.location.href);
  const restoredPath = url.searchParams.get(ROUTE_SEARCH_PARAM);

  if (!restoredPath) {
    return;
  }

  const restoredQuery = url.searchParams.get(QUERY_SEARCH_PARAM);
  const restoredHash = url.searchParams.get(HASH_SEARCH_PARAM);
  const nextUrl = `${getBasePath()}${restoredPath}${restoredQuery ? `?${restoredQuery}` : ""}${restoredHash ? `#${restoredHash}` : ""}`;

  window.history.replaceState(window.history.state, "", nextUrl);
}

function notifyRouteListeners(): void {
  const route = getCurrentRoute();
  for (const listener of listeners) {
    listener(route);
  }
}

export function initializeRouter(): void {
  restorePathFromSpaFallback();
  window.addEventListener("popstate", notifyRouteListeners);
}

export function getCurrentRoute(): AppRoute {
  return routeFromPath(window.location.pathname);
}

export function navigateToRoute(route: AppRoute, options?: { replace?: boolean }): void {
  const nextPath = pathForRoute(route);
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentPath === nextPath) {
    notifyRouteListeners();
    return;
  }

  if (options?.replace) {
    window.history.replaceState(window.history.state, "", nextPath);
  } else {
    window.history.pushState(window.history.state, "", nextPath);
  }

  notifyRouteListeners();
}

export function subscribeToRouteChanges(listener: RouteListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
