package se.scm.backend.user.exception;

/**
 * Exception thrown when a user already exists when creating a user.
 * @author Oliwer Carpman
 * @version 1.0
 */
public class UserAlreadyExistsException extends RuntimeException {
    public UserAlreadyExistsException(String message) {
        super(message);
    }
}
