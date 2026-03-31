package se.scm.backend.user.dto;

import java.time.Instant;
import java.util.UUID;

import se.scm.backend.user.model.UserAwaitingConfirmation;

/**
 * Represents a {@link UserAwaitingConfirmation} response.
 * @author Oliwer Carpman
 * @version 1.0
 * @see UserAwaitingConfirmation
 */
public record UserAwaitingConfirmationResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String phoneNumber,
        String status,
        Instant createdAt,
        Instant expiresAt) {    
    public static UserAwaitingConfirmationResponse fromUserAwaitingConfirmation(UserAwaitingConfirmation userAwaitingConfirmation) {
        return new UserAwaitingConfirmationResponse(
                userAwaitingConfirmation.getId(),
                userAwaitingConfirmation.getPendingEmail(),
                userAwaitingConfirmation.getPendingFirstName(),
                userAwaitingConfirmation.getPendingLastName(),
                userAwaitingConfirmation.getPendingPhoneNumber(),
                "PENDING",
                userAwaitingConfirmation.getCreatedAt(),
                userAwaitingConfirmation.getExpiresAt()
        );
    }
}
