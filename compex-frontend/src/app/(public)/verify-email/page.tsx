import { VerifyEmailClient } from "./VerifyEmailClient";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="px-4 py-20 md:px-8">
      <VerifyEmailClient token={token} />
    </main>
  );
}
