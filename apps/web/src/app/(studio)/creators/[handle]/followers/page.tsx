import { FollowListPage } from "../follow-list";

export const metadata = { title: "Followers" };

export default async function Page({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ before?: string }> }) {
  const [{ handle }, { before }] = await Promise.all([params, searchParams]);
  return <FollowListPage handle={handle} kind="followers" before={before} />;
}
