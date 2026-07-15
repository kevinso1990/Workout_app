/**
 * Legal document URLs shown in the Profile → Legal section and required for
 * App Store review (Privacy Policy is mandatory; Terms of Use is required once
 * subscriptions are enabled).
 *
 * Served as static HTML by nginx on the VPS (already HTTPS). Content still has
 * placeholders to fill (Impressum details) + should get a legal review before
 * the public launch.
 */
export const PRIVACY_POLICY_URL = "https://api.trackyourlift.de/datenschutz.html";
export const TERMS_OF_USE_URL = "https://api.trackyourlift.de/nutzungsbedingungen.html";
export const IMPRESSUM_URL = "https://api.trackyourlift.de/impressum.html";
