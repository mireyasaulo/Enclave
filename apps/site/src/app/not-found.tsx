import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-6 text-center">
      <div>
        <h1 className="text-3xl font-bold mb-2">404</h1>
        <p className="opacity-70 mb-4">该页面不存在 / Page not found</p>
        <Link href="/zh-CN" className="underline">回到首页</Link>
      </div>
    </main>
  );
}
