import { UpgradeLocationClient } from "@/components/UpgradeLocationClient";

export default function TeslaUpgradeLocationPage({
  searchParams,
}: {
  searchParams: {
    token?: string;
    next?: string;
    error?: string;
  };
}) {
  const nextPath =
    searchParams.next && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/dashboard";

  return (
    <UpgradeLocationClient
      token={searchParams.token}
      nextPath={nextPath}
      initialError={searchParams.error}
    />
  );
}
