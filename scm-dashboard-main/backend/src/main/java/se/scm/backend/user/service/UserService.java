package se.scm.backend.user.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import se.scm.backend.common.service.EmailService;
import se.scm.backend.geography.repository.CountryRepository;
import se.scm.backend.geography.repository.RegionRepository;
import se.scm.backend.user.dto.UserRequest;
import se.scm.backend.user.dto.UserResponse;
import se.scm.backend.user.exception.AccessDeniedException;
import se.scm.backend.user.exception.UserAlreadyExistsException;
import se.scm.backend.user.exception.UserNotFoundException;
import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.EmployeeRole;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.user.model.UserAwaitingConfirmation;
import se.scm.backend.user.model.UserChangeHistory;
import se.scm.backend.user.model.UserEmployeeRole;
import se.scm.backend.user.repository.UserAwaitingConfirmationRepository;
import se.scm.backend.user.repository.UserChangeHistoryRepository;
import se.scm.backend.user.repository.EmployeeRoleRepository;
import se.scm.backend.user.repository.UserEmployeeRoleRepository;
import se.scm.backend.user.repository.UserRepository;

/**
 * Service for {@link User} operations.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 * @see UserRepository
 * @see UserEmployeeRoleRepository
 */
@Service
public class UserService {
    private final UserRepository userRepository;
    private final UserEmployeeRoleRepository userEmployeeRoleRepository;
    private final UserChangeHistoryRepository userChangeHistoryRepository;
    private final UserAwaitingConfirmationRepository userAwaitingConfirmationRepository;
    private final EmailService emailService;
    private final EmployeeRoleRepository employeeRoleRepository;
    private final CountryRepository countryRepository;
    private final RegionRepository regionRepository;
    
    public UserService(
            UserRepository userRepository,
            UserEmployeeRoleRepository userEmployeeRoleRepository,
            UserChangeHistoryRepository userChangeHistoryRepository,
            UserAwaitingConfirmationRepository userAwaitingConfirmationRepository,
            EmailService emailService,
            EmployeeRoleRepository employeeRoleRepository,
            CountryRepository countryRepository,
            RegionRepository regionRepository
    ) {
        this.userRepository = userRepository;
        this.userEmployeeRoleRepository = userEmployeeRoleRepository;
        this.userChangeHistoryRepository = userChangeHistoryRepository;
        this.userAwaitingConfirmationRepository = userAwaitingConfirmationRepository;
        this.emailService = emailService;
        this.employeeRoleRepository = employeeRoleRepository;
        this.countryRepository = countryRepository;
        this.regionRepository = regionRepository;
    }

    /**
     * Creates a new user. Public endpoint which will require email confirmation.
     * @param userRequest The request to create a user.
     * @return The user awaiting confirmation.
     * @see confirmUser(String confirmationToken)
     */
    public UserAwaitingConfirmation createUser(UserRequest userRequest) {
        Optional<User> existingUserOpt = userRepository.findByEmail(userRequest.email());
        User existingUser = existingUserOpt.orElse(null);

        if (existingUser != null) {
            RegistrationStatus status = existingUser.getStatus();
            if (status == RegistrationStatus.PENDING) {
                throw new UserAlreadyExistsException("A request to create a user with email: " + userRequest.email() + " is already pending.");
            } else if (status == RegistrationStatus.APPROVED) {
                throw new UserAlreadyExistsException("User with email: " + userRequest.email() + " is already approved and awaiting activation.");
            } else if (status == RegistrationStatus.BLOCKED) {
                throw new UserAlreadyExistsException("User with email: " + userRequest.email() + " is blocked and cannot be reactivated.");
            } else if (status == RegistrationStatus.ACTIVATED) {
                throw new UserAlreadyExistsException("User with email: " + userRequest.email() + " already exists.");
            }
            // For DEACTIVATED/REJECTED we allow re-applying (new email confirmation token).
        }

        String confirmationToken = UUID.randomUUID().toString();
        UserAwaitingConfirmation userAwaitingConfirmation = UserAwaitingConfirmation.builder()
                .pendingEmail(userRequest.email())
                .pendingFirstName(userRequest.firstName())
                .pendingLastName(userRequest.lastName())
                .pendingPhoneNumber(userRequest.getPhoneNumber())
                .pendingCountryId(userRequest.countryId())
                .pendingRegionId(userRequest.regionId())
                .pendingPasswordHash(new BCryptPasswordEncoder().encode(userRequest.password()))
                .confirmationTokenHash(DigestUtils.md5DigestAsHex(confirmationToken.getBytes()))
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(1, ChronoUnit.DAYS))
                .build();

        // Enforce "one active confirmation token per email" by replacing any existing pending row.
        userAwaitingConfirmationRepository.deleteByPendingEmail(userRequest.email());
        userAwaitingConfirmationRepository.save(userAwaitingConfirmation);

        // Send confirmation token to user's email.
        emailService.sendConfirmationToken(userAwaitingConfirmation, confirmationToken);

        return userAwaitingConfirmation;
    }

    /**
     * Creates a new user. Used for admin to create a user manually.
     * @param userRequest The request to create a user.
     * @return The created user.
     */
    public User createUserAdmin(UserRequest userRequest) {
        User actorUser = getCurrentUser();
        if (!hasRoleOrHigherByCurrentUser(EmployeeRoleCode.REGION_MANAGER)) {
            throw new AccessDeniedException("User: " + actorUser.getEmail() + " is not an administrator, office personnel or regional manager.");
        }
        Optional<User> existingUserOpt = userRepository.findByEmail(userRequest.email());
        User existingUser = existingUserOpt.orElse(null);
        if (existingUser != null) {
            throw new UserAlreadyExistsException("User with email: " + userRequest.email() + " already exists.");
        }
        User user = userRepository.save(User.createApproved(userRequest));
        assignStaffRole(user, userRequest.countryId(), userRequest.regionId());
        return user;
    }

    /**
     * Confirms a user through email confirmation.
     * @param confirmationToken The confirmation token.
     * @return The confirmed user.
     */
    public User confirmUser(String confirmationToken) {
        String confirmationTokenHash = DigestUtils.md5DigestAsHex(confirmationToken.getBytes());
        UserAwaitingConfirmation userAwaitingConfirmation = userAwaitingConfirmationRepository.findByConfirmationTokenHash(confirmationTokenHash).orElseThrow(() ->
                new UserNotFoundException("User not found with confirmation token: " + confirmationToken + " or confirmation token has expired."));

        if (userAwaitingConfirmation.getExpiresAt().isBefore(Instant.now())) {
            throw new UserNotFoundException("Confirmation token expired for user.");
        }

        String pendingEmail = userAwaitingConfirmation.getPendingEmail();
        Optional<User> existingUserOpt = userRepository.findByEmail(pendingEmail);
        User user;

        // Create a "pending user" from the awaiting-confirmation record.
        User pendingUser = User.fromAwaitingConfirmation(userAwaitingConfirmation);

        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            RegistrationStatus statusBefore = existingUser.getStatus();

            // Update the existing user record (email is unique, so we cannot create a new row).
            existingUser.setFirstName(pendingUser.getFirstName());
            existingUser.setLastName(pendingUser.getLastName());
            existingUser.setPhoneNumber(pendingUser.getPhoneNumber());
            existingUser.setPasswordHash(pendingUser.getPasswordHash());
            existingUser.setStatus(RegistrationStatus.PENDING);

            user = userRepository.save(existingUser);

            userChangeHistoryRepository.save(
                    UserChangeHistory.userStatusChange(
                            null, // actor null when user applies again (public endpoint)
                            user, // target
                            statusBefore,
                            RegistrationStatus.PENDING,
                            "User confirmed their email and submitted their application."
                    )
            );
        } else {
            // New user: create it only after the email confirmation succeeds.
            user = userRepository.save(pendingUser);

            userChangeHistoryRepository.save(
                    UserChangeHistory.userStatusChange(
                            null, // actor null when user applies again (public endpoint)
                            user, // target
                            null, // statusBefore
                            RegistrationStatus.PENDING,
                            "User confirmed their email and submitted their application."
                    )
            );
        }

        assignStaffRole(user, userAwaitingConfirmation.getPendingCountryId(), userAwaitingConfirmation.getPendingRegionId());

        userAwaitingConfirmationRepository.delete(userAwaitingConfirmation);
        return user;
    }

    /** 
     * Assigns the staff role to a user.
     * @param user The user to assign the staff role to.
     * @param pendingCountryId The country id where the role is valid, if restricted to a specific country.
     * @param pendingRegionId The region id where the role is valid, if restricted to a specific region.
     */
    private void assignStaffRole(User user, UUID pendingCountryId, UUID pendingRegionId) {
        EmployeeRole staffRole = employeeRoleRepository.findByEmployeeRoleCode(EmployeeRoleCode.STAFF)
                .orElseThrow(() -> new se.scm.backend.user.exception.UserNotFoundException("Employee role not found: " + EmployeeRoleCode.STAFF));

        UserEmployeeRole userEmployeeRole = new UserEmployeeRole();
        userEmployeeRole.setUser(user);
        userEmployeeRole.setEmployeeRole(staffRole);

        userEmployeeRole.setCountry(pendingCountryId != null ? countryRepository.getReferenceById(pendingCountryId) : null);
        userEmployeeRole.setRegion(pendingRegionId != null ? regionRepository.getReferenceById(pendingRegionId) : null);
        userEmployeeRole.setActive(true);

        userEmployeeRoleRepository.save(userEmployeeRole);
    }

    /**
     * Changes the registration status of a user. Used to approve, reject, block or deactivate a user.
     * @param email The email of the user.
     * @param status The new status of the user.
     * @param reason The reason for changing the registration status. Optional.
     * @return The user with the new registration status.
     */
    public User changeRegistrationStatus(String email, RegistrationStatus status, String reason) {
        User actorUser = getCurrentUser();
        if (!hasRoleOrHigherByCurrentUser(EmployeeRoleCode.REGION_MANAGER)) {
            throw new AccessDeniedException("User: " + actorUser.getEmail() + " is not an administrator, office personnel or regional manager.");
        }
        User user = userRepository.findByEmail(email).orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));

        // Rule: a user may not change the status of another user that has the same or lower highest role.
        int actorHighestRoleLevel = getHighestActiveRoleLevelByUserId(actorUser.getId());
        int targetHighestRoleLevel = getHighestActiveRoleLevelByUserId(user.getId());
        if (actorHighestRoleLevel <= targetHighestRoleLevel) {
            throw new AccessDeniedException("You cannot change the status of a user with same or higher role level.");
        }

        RegistrationStatus statusBefore = user.getStatus();
        if (statusBefore == status) {
            throw new IllegalArgumentException("User already has status: " + status.name());
        }

        if (statusBefore != RegistrationStatus.PENDING && (status == RegistrationStatus.APPROVED || status == RegistrationStatus.REJECTED)) {
            throw new IllegalArgumentException("User is not pending and cannot be approved or rejected.");
        }

        if (statusBefore == RegistrationStatus.PENDING && status == RegistrationStatus.DEACTIVATED) {
            throw new IllegalArgumentException("User is still pending and cannot be deactivated.");
        }

        user.setStatus(status);
        userChangeHistoryRepository.save(
            UserChangeHistory.userStatusChange(
                actorUser, // actor
                user, // target
                statusBefore, // statusBefore
                status,
                reason
            )
        );
        return userRepository.save(user);
    }

    /**
     * Modifies a user. Used to modify a user's information. Accessible to the user themselves and administrators, office personnel or regional managers.
     * @param email The email of the user.
     * @param userRequest The request to modify the user.
     * @return The modified user.
     */
    public User modifyUser(String email, UserRequest userRequest) {
        User actorUser = getCurrentUser();
        if (!email.equals(actorUser.getEmail()) && !hasRoleOrHigherByCurrentUser(EmployeeRoleCode.REGION_MANAGER)) {
            throw new AccessDeniedException("User: " + actorUser.getEmail() + " is not an administrator, office personnel or regional manager and not the user themselves.");
        }
        User user = userRepository.findByEmail(email).orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
        user.setFirstName(userRequest.firstName());
        user.setLastName(userRequest.lastName());
        user.setPhoneNumber(userRequest.getPhoneNumber());
        user.setPasswordHash(new BCryptPasswordEncoder().encode(userRequest.password()));
        return userRepository.save(user);
    }

    /**
     * Gets the current user from the security context.
     * @return The current user.
     */
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByEmail(authentication.getName()).orElseThrow(() -> new UserNotFoundException("User not found with email: " + authentication.getName()));
    }

    /**
     * Finds a user by their email.
     * @param email The email of the user.
     * @return The user.
     */
    public User findByEmail(String email) {
        return userRepository.findByEmail(email).orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
    }

    /**
     * Gets all users. Not available for regular staff.
     * @return The users.
     */
    public List<UserResponse> getAllUsers() {
        if (!hasRoleOrHigherByCurrentUser(EmployeeRoleCode.TEMPORARY_GIG_MANAGER)) {
            throw new AccessDeniedException("Not allowed");
        }
        return userRepository.findAll()
                .stream()
                .map(UserResponse::fromUser)
                .toList();
    }

    /**
     * Gets all users with a specific status. Only available for administrators, office personnel or regional managers.
     * @param status The status of the users.
     * @return The users.
     */
    public List<UserResponse> getAllUsersByStatus(RegistrationStatus status) {
        if (!hasRoleOrHigherByCurrentUser(EmployeeRoleCode.REGION_MANAGER)) {
            throw new AccessDeniedException("Not allowed");
        }
    
        return userRepository.findByStatus(status)
                .stream()
                .map(UserResponse::fromUser)
                .toList();
    }

    /**
     * Checks if the current user has a specific role.
     * @param role The role to check.
     * @return True if the current user has the role, false otherwise.
     */
    public boolean hasRoleByCurrentUser(EmployeeRoleCode role) {
        User user = getCurrentUser();
        List<EmployeeRoleCode> codes = userEmployeeRoleRepository.findActiveEmployeeRoleCodesByUserId(user.getId());
        return codes.contains(role);
    }

    /**
     * Checks if a user has a specific role by their email.
     * @param email The email of the user.
     * @param role The role to check.
     * @return True if the user has the role, false otherwise.
     */
    public boolean hasRoleByEmail(String email, EmployeeRoleCode role) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
        List<EmployeeRoleCode> codes = userEmployeeRoleRepository.findActiveEmployeeRoleCodesByUserId(user.getId());
        return codes.contains(role);
    }

    /**
     * Checks if the current user has a specific role, or a role with a higher level of authority.
     * @param role The role to check minimum level of authority for.
     * @return True if the current user has the role, or a role with a higher level of authority, false otherwise.
     */
    public boolean hasRoleOrHigherByCurrentUser(EmployeeRoleCode role) {
        User user = getCurrentUser();
        List<EmployeeRoleCode> codes = userEmployeeRoleRepository.findActiveEmployeeRoleCodesByUserId(user.getId());
        return codes.stream().anyMatch(code -> code.getLevel() >= role.getLevel());
    }

    /**
     * Checks if a user has a specific role, or a role with a higher level of authority by their email.
     * @param email The email of the user.
     * @param role The role to check minimum level of authority for.
     * @return True if the user has the role, or a role with a higher level of authority, false otherwise.
     */
    public boolean hasRoleOrHigherByEmail(String email, EmployeeRoleCode role) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
        List<EmployeeRoleCode> codes = userEmployeeRoleRepository.findActiveEmployeeRoleCodesByUserId(user.getId());
        return codes.stream().anyMatch(code -> code.getLevel() >= role.getLevel());
    }

    private int getHighestActiveRoleLevelByUserId(UUID userId) {
        return userEmployeeRoleRepository.findActiveEmployeeRoleCodesByUserId(userId)
                .stream()
                .mapToInt(EmployeeRoleCode::getLevel)
                .max()
                .orElse(0);
    }
}
