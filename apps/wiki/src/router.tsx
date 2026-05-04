import { lazy } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { RootLayout } from "./components/root-layout";

const HomePage = lazy(async () => {
  const mod = await import("./routes/home-page");
  return { default: mod.HomePage };
});

const LoginPage = lazy(async () => {
  const mod = await import("./routes/login-page");
  return { default: mod.LoginPage };
});

const RegisterPage = lazy(async () => {
  const mod = await import("./routes/register-page");
  return { default: mod.RegisterPage };
});

const CharacterPage = lazy(async () => {
  const mod = await import("./routes/character-page");
  return { default: mod.CharacterPage };
});

const CreateCharacterPage = lazy(async () => {
  const mod = await import("./routes/create-character-page");
  return { default: mod.CreateCharacterPage };
});

const PendingReviewsPage = lazy(async () => {
  const mod = await import("./routes/pending-reviews-page");
  return { default: mod.PendingReviewsPage };
});

const RecentChangesPage = lazy(async () => {
  const mod = await import("./routes/recent-changes-page");
  return { default: mod.RecentChangesPage };
});

const AdminUsersPage = lazy(async () => {
  const mod = await import("./routes/admin-users-page");
  return { default: mod.AdminUsersPage };
});

const AdminBlocksPage = lazy(async () => {
  const mod = await import("./routes/admin-blocks-page");
  return { default: mod.AdminBlocksPage };
});

const AdminProtectionPage = lazy(async () => {
  const mod = await import("./routes/admin-protection-page");
  return { default: mod.AdminProtectionPage };
});

const WatchlistPage = lazy(async () => {
  const mod = await import("./routes/watchlist-page");
  return { default: mod.WatchlistPage };
});

const SearchPage = lazy(async () => {
  const mod = await import("./routes/search-page");
  return { default: mod.SearchPage };
});

const AdminReportsPage = lazy(async () => {
  const mod = await import("./routes/admin-reports-page");
  return { default: mod.AdminReportsPage };
});

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: RegisterPage,
});

const characterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/character/$characterId",
  component: CharacterPage,
});

const createCharacterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/create",
  component: CreateCharacterPage,
});

const pendingReviewsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pending-reviews",
  component: PendingReviewsPage,
});

const recentChangesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recent-changes",
  component: RecentChangesPage,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/users",
  component: AdminUsersPage,
});

const adminBlocksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/blocks",
  component: AdminBlocksPage,
});

const adminProtectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/protection",
  component: AdminProtectionPage,
});

const watchlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watchlist",
  component: WatchlistPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

const adminReportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/reports",
  component: AdminReportsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  characterRoute,
  createCharacterRoute,
  pendingReviewsRoute,
  recentChangesRoute,
  adminUsersRoute,
  adminBlocksRoute,
  adminProtectionRoute,
  adminReportsRoute,
  watchlistRoute,
  searchRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
