package se.scm.backend.user.exception;

/**
 * Exception thrown when a user is not authorized to access a resource.
 * @author Oliwer Carpman
 * @version 1.0
 */
public class AccessDeniedException extends RuntimeException {
    public AccessDeniedException(String message) {
        super(message);
    }
}
