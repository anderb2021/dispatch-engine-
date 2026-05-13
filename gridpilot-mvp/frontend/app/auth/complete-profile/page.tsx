import { CompleteProfileEmailClient } from "@/components/CompleteProfileEmailClient";

export default function CompleteProfilePage({
  searchParams,
}: {
  searchParams: {
    next?: string;
  };
}) {
  const nextPath =
    searchParams.next && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/dashboard";

  return <CompleteProfileEmailClient nextPath={nextPath} />;
}
