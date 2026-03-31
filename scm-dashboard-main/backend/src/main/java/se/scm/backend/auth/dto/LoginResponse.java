package se.scm.backend.auth.dto;

/**
 * Represents a login response.
 * @param token The JWT token.
 */
public record LoginResponse(String token) {
}

