// Setup wizard gate shared by the dashboard redirect and the setup route.
export function setupIsPending(state = {}) {
  return state?.setupCompleted !== true && state?.setupSkipped !== true;
}
