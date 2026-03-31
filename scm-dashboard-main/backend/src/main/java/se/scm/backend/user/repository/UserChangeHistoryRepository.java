package se.scm.backend.user.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import se.scm.backend.user.model.UserChangeHistory;

public interface UserChangeHistoryRepository extends JpaRepository<UserChangeHistory, UUID> {
    // Finds the change history for a user by their id, ordered by creation date descending.
    List<UserChangeHistory> findByTargetUser_IdOrderByCreatedAtDesc(UUID targetUserId);
}

