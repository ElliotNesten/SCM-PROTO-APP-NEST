package se.scm.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Represents a login request.
 * @param email The email of the user.
 * @param password The password of the user.
 */
public record LoginRequest(
        @Email @NotBlank String email,
        @NotBlank String password) {
}

