// Setup wizard gate shared by the dashboard redirect and the setup route.
export function setupIsPending(state = {}) {
  // Required steps (plan, app embed, theme files) gate the app; "skip" only lasts one visit.
  return state?.requiredStepsComplete !== true;
}
