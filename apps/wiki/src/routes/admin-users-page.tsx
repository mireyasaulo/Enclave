import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, ErrorBlock, LoadingBlock, StatusPill } from "@yinjie/ui";
import { hasRole, roleLabel } from "../lib/auth-store";
import { useAuth } from "../lib/use-auth";
import { wikiApi, type WikiUserRow } from "../lib/wiki-api";

type WikiRole = "newcomer" | "autoconfirmed" | "patroller" | "admin";

const ROLE_OPTIONS: WikiRole[] = [
  "newcomer",
  "autoconfirmed",
  "patroller",
  "admin",
];

export function AdminUsersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const usersQ = useQuery({
    queryKey: ["wiki", "users"],
    queryFn: () => wikiApi.listUsers(),
    enabled: hasRole(user, "admin"),
  });
  const setRoleMut = useMutation({
    mutationFn: (input: {
      userId: string;
      role: WikiRole;
      reason?: string;
    }) => wikiApi.setUserRole(input.userId, input.role, input.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wiki", "users"] }),
  });

  if (!hasRole(user, "admin")) {
    return (
      <Card className="p-6">
        <p>仅管理员可访问。</p>
      </Card>
    );
  }
  if (usersQ.isLoading) return <LoadingBlock />;
  if (usersQ.isError)
    return <ErrorBlock message={(usersQ.error as Error).message} />;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">用户与角色（{usersQ.data?.length ?? 0}）</h1>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
            <tr>
              <th className="py-2 px-3">用户</th>
              <th className="py-2 px-3">类型</th>
              <th className="py-2 px-3">注册</th>
              <th className="py-2 px-3">角色</th>
              <th className="py-2 px-3">编辑/通过/被回滚/巡查</th>
              <th className="py-2 px-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.data?.map((u) => (
              <tr key={u.id} className="border-b border-[var(--border-subtle)]">
                <td className="py-2 px-3 font-medium">{u.username}</td>
                <td className="py-2 px-3 text-xs">
                  {u.userType === "world_owner" ? (
                    <StatusPill>世界主</StatusPill>
                  ) : (
                    "wiki 成员"
                  )}
                </td>
                <td className="py-2 px-3 text-xs text-[var(--text-muted)]">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2 px-3">
                  <StatusPill>{roleLabel(u.role)}</StatusPill>
                </td>
                <td className="py-2 px-3 text-xs text-[var(--text-muted)]">
                  {u.profile
                    ? `${u.profile.editCount}/${u.profile.approvedEditCount}/${u.profile.revertedCount}/${u.profile.patrolledCount}`
                    : "—"}
                </td>
                <td className="py-2 px-3">
                  <select
                    className="text-sm border rounded px-2 py-1 bg-white"
                    value={u.role}
                    disabled={
                      u.id === user?.id || setRoleMut.isPending
                    }
                    onChange={(e) =>
                      setRoleMut.mutate({
                        userId: u.id,
                        role: e.target.value as WikiRole,
                      })
                    }
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {setRoleMut.isError && (
        <ErrorBlock message={(setRoleMut.error as Error).message} />
      )}
    </div>
  );
}
