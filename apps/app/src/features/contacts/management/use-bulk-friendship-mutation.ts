import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkFriendshipAction,
  type BulkFriendshipRequest,
} from "@yinjie/contracts";

export function useBulkFriendshipMutation(onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkFriendshipRequest) =>
      bulkFriendshipAction(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const k = String(query.queryKey?.[0] ?? "");
          return (
            k === "app-friends" ||
            k === "app-friend-requests" ||
            k === "app-contacts-blocked" ||
            k === "app-conversations" ||
            k === "app-friends-quick-start" ||
            k === "app-group-friends" ||
            k === "app-chat-details-blocked" ||
            k === "app-chat-blocked-characters"
          );
        },
      });
      onDone?.();
    },
  });
}
