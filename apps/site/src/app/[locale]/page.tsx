export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className="min-h-screen grid place-items-center text-center px-6">
      <div>
        <h1 className="text-4xl font-bold mb-4">隐界 · Enclave</h1>
        <p className="text-lg opacity-70">
          Skeleton ready · locale = <code>{locale}</code>
        </p>
      </div>
    </main>
  );
}
