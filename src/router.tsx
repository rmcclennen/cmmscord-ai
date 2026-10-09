import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data for a day so it can be saved to the device and shown with no signal.
        gcTime: 24 * 60 * 60 * 1000,
        // Don't refetch the instant a screen remounts; focus/reconnect still refresh.
        staleTime: 15_000,
        retry: (count, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (status && status >= 400 && status < 500) return false; // won't fix itself
          return count < 2;
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
