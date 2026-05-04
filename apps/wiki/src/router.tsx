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

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  registerRoute,
  characterRoute,
  pendingReviewsRoute,
  recentChangesRoute,
  adminUsersRoute,
  adminBlocksRoute,
  adminProtectionRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
