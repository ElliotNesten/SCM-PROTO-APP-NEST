package se.scm.backend.user.model;

/**
 * Represents the status of a user's registration.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 */
public enum RegistrationStatus {
    PENDING, // Application submitted
    APPROVED, // Application approved by admin
    REJECTED, // Application rejected by admin
    BLOCKED, // User blocked by admin and can no longer submit applications
    ACTIVATED, // User activated their account and completed their profile
    DEACTIVATED // User deactivated their account or through inactivity
}