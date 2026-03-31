package se.scm.backend.user.model;

/**
 * Represents the type of event that occurred for {@link UserChangeHistory}.
 * @author Oliwer Carpman
 * @version 1.0
 * @see UserChangeHistory
 */
public enum EventType {
    USER_STATUS_CHANGE,
    USER_EMPLOYEE_ROLE_ACTIVATE,
    USER_EMPLOYEE_ROLE_DEACTIVATE
}
