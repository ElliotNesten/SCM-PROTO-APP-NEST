package se.scm.backend.user.exception;

/**
 * Exception thrown when a user is not found.
 * @author Oliwer Carpman
 * @version 1.0
 */
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) {
        super(message);
    }
    
}
