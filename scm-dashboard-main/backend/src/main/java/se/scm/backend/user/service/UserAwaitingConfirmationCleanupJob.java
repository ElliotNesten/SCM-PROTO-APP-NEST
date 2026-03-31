package se.scm.backend.user.service;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import se.scm.backend.user.repository.UserAwaitingConfirmationRepository;

@Component
public class UserAwaitingConfirmationCleanupJob {
    private static final Logger log = LoggerFactory.getLogger(UserAwaitingConfirmationCleanupJob.class);

    private final UserAwaitingConfirmationRepository userAwaitingConfirmationRepository;

    public UserAwaitingConfirmationCleanupJob(UserAwaitingConfirmationRepository userAwaitingConfirmationRepository) {
        this.userAwaitingConfirmationRepository = userAwaitingConfirmationRepository;
    }

    // Cleanup every hour.
    @Scheduled(fixedDelay = 1 * 60 * 60 * 1000L)
    @Transactional
    public void cleanupExpiredTokens() {
        Instant now = Instant.now();
        long deleted = userAwaitingConfirmationRepository.deleteByExpiresAtBefore(now);
        if (deleted > 0) {
            log.info("Cleaned up {} expired user awaiting confirmation tokens.", deleted);
        }
    }
}

