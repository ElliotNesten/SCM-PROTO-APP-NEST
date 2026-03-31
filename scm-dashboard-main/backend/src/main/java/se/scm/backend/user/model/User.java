package se.scm.backend.user.model;

import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import se.scm.backend.common.model.BaseEntity;
import se.scm.backend.user.dto.UserRequest;

/**
 * Represents a user in the system. Both office personnel and hourly workers.
 * @author Oliwer Carpman
 * @version 1.0
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "platform_user")
public class User extends BaseEntity {
    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;
    
    @Column(nullable = true)
    private String phoneNumber;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private RegistrationStatus status;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private Set<UserEmployeeRole> userEmployeeRoles = new HashSet<>();

    /**
     * Creates a new pending {@link User} instance based on a {@link UserRequest}.
     * @param userRequest The request to create a user.
     * @return The pending user.
     */
    public static User createPending(UserRequest userRequest) {
        if (!userRequest.password().equals(userRequest.confirmPassword())) {
            throw new IllegalArgumentException("Passwords do not match");
        }

        BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

        User user = new User();
        user.setEmail(userRequest.email());
        user.setFirstName(userRequest.firstName());
        user.setLastName(userRequest.lastName());
        user.setPhoneNumber(userRequest.getPhoneNumber());
        user.setPasswordHash(passwordEncoder.encode(userRequest.password()));
        user.setStatus(RegistrationStatus.PENDING);
        return user;
    }

    public static User createApproved(UserRequest userRequest) {
        BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

        User user = new User();
        user.setEmail(userRequest.email());
        user.setFirstName(userRequest.firstName());
        user.setLastName(userRequest.lastName());
        user.setPhoneNumber(userRequest.getPhoneNumber());
        user.setPasswordHash(passwordEncoder.encode(userRequest.password()));   
        user.setStatus(RegistrationStatus.APPROVED);
        return user;
    }

    /**
     * Creates a new pending {@link User} instance based on a persisted
     * {@link UserAwaitingConfirmation} record.
     * @param userAwaitingConfirmation The user awaiting confirmation.
     * @return The user.
     */
    public static User fromAwaitingConfirmation(UserAwaitingConfirmation userAwaitingConfirmation) {
        User user = new User();
        user.setEmail(userAwaitingConfirmation.getPendingEmail());
        user.setFirstName(userAwaitingConfirmation.getPendingFirstName());
        user.setLastName(userAwaitingConfirmation.getPendingLastName());
        user.setPhoneNumber(userAwaitingConfirmation.getPendingPhoneNumber());
        // The pending password hash is already BCrypt-hashed when the confirmation record is created.
        user.setPasswordHash(userAwaitingConfirmation.getPendingPasswordHash());
        user.setStatus(RegistrationStatus.PENDING);
        return user;
    }
}
