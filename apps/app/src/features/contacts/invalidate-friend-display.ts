import type { QueryClient } from "@tanstack/react-query";

// 备注/标签更新后，凡是后端会按 viewer 备注重新解析作者名/会话标题的查询，
// 都得 invalidate 一遍，否则界面还会用旧缓存里那份未带备注的字段。
export async function invalidateFriendDisplayQueries(
  queryClient: QueryClient,
  baseUrl?: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["app-friends", baseUrl] }),
    queryClient.invalidateQueries({ queryKey: ["app-conversations", baseUrl] }),
    queryClient.invalidateQueries({
      queryKey: ["app-conversation-messages", baseUrl],
    }),
    queryClient.invalidateQueries({ queryKey: ["app-moments", baseUrl] }),
    queryClient.invalidateQueries({ queryKey: ["app-moments-paged", baseUrl] }),
    queryClient.invalidateQueries({ queryKey: ["app-feed", baseUrl] }),
    queryClient.invalidateQueries({ queryKey: ["app-feed-paged", baseUrl] }),
    queryClient.invalidateQueries({ queryKey: ["app-feed-post", baseUrl] }),
  ]);
}
