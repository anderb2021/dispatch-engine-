import { TeslaLoginCallbackClient } from "@/components/TeslaLoginCallbackClient";

export default function TeslaLoginCallbackPage({
  searchParams,
}: {
  searchParams: {
    access_token?: string;
    refresh_token?: string;
    next?: string;
    error?: string;
    connected?: string;
  };
}) {
  const callbackError =
    searchParams.error ||
    (searchParams.connected === "false" ? "Tesla authorization was not completed." : undefined);

  return (
    <TeslaLoginCallbackClient
      accessToken={searchParams.access_token}
      refreshToken={searchParams.refresh_token}
      nextPath={searchParams.next || "/dashboard"}
      callbackError={callbackError}
    />
  );
}
