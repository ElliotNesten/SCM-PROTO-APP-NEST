package se.scm.backend.user.repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import se.scm.backend.user.model.UserAwaitingConfirmation;

public interface UserAwaitingConfirmationRepository extends JpaRepository<UserAwaitingConfirmation, UUID> {
    Optional<UserAwaitingConfirmation> findByConfirmationTokenHash(String confirmationTokenHash);
    boolean existsByConfirmationTokenHash(String confirmationTokenHash);
    long deleteByPendingEmail(String pendingEmail);
    long deleteByExpiresAtBefore(Instant now);
    void deleteByConfirmationTokenHash(String confirmationTokenHash);
}
