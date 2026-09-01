import { SetupAccountClient } from "./SetupAccountClient";

export default async function SetupAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <main className="px-4 py-20 md:px-8"><SetupAccountClient token={token} /></main>;
}
