package se.scm.backend.user.model;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Represents a user awaiting confirmation via email.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 */
@Getter
@Setter
@NoArgsConstructor  
@AllArgsConstructor
@Builder
@Entity
@Table(name = "user_awaiting_confirmation")
public class UserAwaitingConfirmation {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "pending_email")
    private String pendingEmail;

    @Column(name = "pending_first_name")
    private String pendingFirstName;

    @Column(name = "pending_last_name")
    private String pendingLastName;

    @Column(name = "pending_phone_number")
    private String pendingPhoneNumber;

    @Column(name = "pending_password_hash")
    private String pendingPasswordHash;

    @Column(name = "pending_country_id")
    private UUID pendingCountryId;

    @Column(name = "pending_region_id")
    private UUID pendingRegionId;

    @Column(name = "confirmation_token_hash")
    private String confirmationTokenHash;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;
}
