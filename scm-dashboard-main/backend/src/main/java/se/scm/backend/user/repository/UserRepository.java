package se.scm.backend.user.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findById(UUID id);
    boolean existsById(UUID id);
    
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    Optional<User> findByPhoneNumber(String phoneNumber);
    boolean existsByPhoneNumber(String phoneNumber);

    List<User> findByStatus(RegistrationStatus status);
}