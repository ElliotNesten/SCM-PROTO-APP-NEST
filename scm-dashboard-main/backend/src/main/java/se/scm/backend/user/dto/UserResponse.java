package se.scm.backend.user.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import se.scm.backend.user.model.User;

/**
 * Represents a {@link User} response.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 */
public record UserResponse(
        UUID id,
        String email,
        String firstName,
        String lastName,
        String phoneNumber,
        String status,
        Instant createdAt,
        Instant updatedAt) {
    public static UserResponse fromUser(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhoneNumber(),
                user.getStatus().name(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
    public static List<UserResponse> fromUsers(List<User> users) {
        return users.stream().map(UserResponse::fromUser).collect(Collectors.toList());
    }
}
