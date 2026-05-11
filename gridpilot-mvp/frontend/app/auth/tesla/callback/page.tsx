import { TeslaLoginCallbackClient } from "@/components/TeslaLoginCallbackClient";

export default function TeslaLoginCallbackPage({
  searchParams,
}: {
  searchParams: {
    access_token?: string;
    refresh_token?: string;
    next?: string;
  };
}) {
  return (
    <TeslaLoginCallbackClient
      accessToken={searchParams.access_token}
      refreshToken={searchParams.refresh_token}
      nextPath={searchParams.next || "/dashboard"}
    />
  );
}
