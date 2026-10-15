import { QueryClient, MutationCache } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute fresh cache by default
        gcTime: 10 * 60 * 1000,
        refetchOnMount: false, // Instant renders from cache
        refetchOnWindowFocus: false, // Don't freeze browser on tab switch
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 60 * 1000,
  });

  return router;
};
