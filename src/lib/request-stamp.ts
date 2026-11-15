import { cache } from "react";

/**
 * One stamp per server render (per request - React's cache() scopes it so).
 * Passed as a prop from a server shell to a client component, it changes
 * exactly when the shell was rendered again on the server (router.refresh,
 * a revalidatePath after her own action), so the client component can
 * refetch the data it owns - and never on a client-side re-render.
 */
export const renderStamp = cache((): number => Date.now());
