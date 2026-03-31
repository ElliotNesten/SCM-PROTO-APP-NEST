package se.scm.backend.user.dto;

import java.util.UUID;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Represents a request to create a user.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 */
public record UserRequest(
        @Email @NotBlank String email,
        @NotBlank String firstName,
        @NotBlank String lastName,
        @Pattern(regexp = "^\\+\\d{1,3}$") String phoneLanguageCode,
        @Pattern(regexp = "^\\d+$") String phoneNumber,
        @NotBlank UUID countryId,
        UUID regionId,
        @NotBlank String password,
        @NotBlank String confirmPassword) {
        public String getPhoneNumber() {
            if (phoneLanguageCode != null && phoneNumber != null) {
                // Convert to a single E.164-like string:
                // eg +46 + 0123456789 -> +46123456789
                String nationalNumber = phoneNumber.startsWith("0") ? phoneNumber.substring(1) : phoneNumber;
                return phoneLanguageCode + nationalNumber;
            }
            return null;
        }
}
