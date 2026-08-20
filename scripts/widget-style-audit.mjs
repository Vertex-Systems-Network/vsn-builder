import { widgetRegistry } from "../app/builder/widgetRegistry.js";
import { auditWidgetCapabilityCoverage } from "../app/builder/widgetCapabilities.js";
import { auditWidgetStyleProfiles, getWidgetStyleProfile } from "../app/builder/widgetStyleProfiles.js";

const types = Object.keys(widgetRegistry);
const caps = auditWidgetCapabilityCoverage(types);
const styles = auditWidgetStyleProfiles(types);
const extra = types.filter((type) => getWidgetStyleProfile(type).features.length > 0);
if (caps.missing.length) throw new Error(`Missing capability profiles: ${caps.missing.join(", ")}`);
if (styles.profiled !== types.length) throw new Error(`Widget style profile coverage mismatch: ${styles.profiled}/${types.length}`);
console.log(`Widget capability coverage: ${caps.covered}/${caps.total}`);
console.log(`Widget style profiles: ${styles.profiled}/${styles.total}`);
console.log(`Widgets with component-level style controls: ${extra.length}`);
console.log(`Widgets intentionally using global/root controls only: ${styles.noExtraControls.length}`);
