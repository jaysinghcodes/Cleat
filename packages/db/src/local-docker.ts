export const LOCAL_DOCKER_MESSAGE =
  "Docker is not running. Open Docker Desktop, wait until it says running, then try again.";

const LOCAL_PORT = "54322";

/** Docker is required only for the default local Supabase port. */
export function seedNeedsLocalDocker(databaseUrl: string | undefined): boolean {
  const configured = databaseUrl?.trim() ?? "";
  if (configured.length === 0) return true;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return false;
  }
  const host = url.hostname;
  const localHost = host === "127.0.0.1" || host === "localhost";
  return localHost && url.port === LOCAL_PORT;
}

export function assertDockerWhenLocal(databaseUrl: string | undefined, dockerInfo: () => void): void {
  if (!seedNeedsLocalDocker(databaseUrl)) return;
  try {
    dockerInfo();
  } catch {
    throw new Error(LOCAL_DOCKER_MESSAGE);
  }
}
