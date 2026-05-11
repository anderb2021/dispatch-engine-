import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export default function TeslaCallbackPage({
  searchParams,
}: {
  searchParams: {
    connected?: string;
    dry_run?: string;
    error?: string;
  };
}) {
  const connected = searchParams.connected === "true";
  const dryRun = searchParams.dry_run === "true";
  const error = searchParams.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        {connected ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grid-50 text-grid-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-slate-950">Tesla connected</h1>
            <p className="mt-3 text-slate-600">
              GridPilot can now begin building a passive flexibility profile for this vehicle.
            </p>
            {dryRun ? (
              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-left text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Dry-run mode is active. No real Tesla token was stored and no vehicle commands will be sent.</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-grid-50 p-4 text-sm text-grid-900">
                Live Tesla OAuth completed. Next step: fetch vehicles from the backend.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold text-slate-950">Connection failed</h1>
            <p className="mt-3 break-words text-slate-600">{error || "The Tesla connection could not be completed."}</p>
          </>
        )}

        <Link href="/" className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white">
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}