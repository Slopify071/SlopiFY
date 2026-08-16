/**
 * Admin authorization configuration.
 *
 * Checks the current user's email against an allow-list sourced from
 * the VITE_ADMIN_EMAILS environment variable (comma-separated) with a
 * hardcoded fallback list for development convenience.
 */

// Fallback admin emails when VITE_ADMIN_EMAILS is not set.
// Add your admin email(s) here for local development.
const FALLBACK_ADMIN_EMAILS = ['ishaanthakur49@gmail.com']

/**
 * Returns the set of admin emails from env or fallback config.
 */
function getAdminEmails() {
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS
  if (envEmails && typeof envEmails === 'string') {
    return envEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  }
  return FALLBACK_ADMIN_EMAILS.map((e) => e.trim().toLowerCase())
}

/**
 * Check whether a Firebase user object belongs to an admin.
 * @param {Object|null} user - Firebase Auth user object (or null)
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user?.email) return false
  const adminEmails = getAdminEmails()
  return adminEmails.includes(user.email.toLowerCase())
}
