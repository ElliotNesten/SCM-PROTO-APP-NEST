package se.scm.backend.user.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import se.scm.backend.user.dto.UserAwaitingConfirmationResponse;
import se.scm.backend.user.dto.UserRequest;
import se.scm.backend.user.dto.UserResponse;
import se.scm.backend.user.exception.AccessDeniedException;
import se.scm.backend.user.exception.UserAlreadyExistsException;
import se.scm.backend.user.exception.UserNotFoundException;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.user.service.UserService;

/**
 * Handles {@link User} requests.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 * @see UserService
 */
@RestController
@RequestMapping("/api/user")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * Public endpoint to create a new user. Used for public registration. Requires confirmation via email.
     * @param userRequest The request to create a user.
     * @return The user awaiting confirmation.
     * @see confirmUser(String confirmationToken)
     */
    @PostMapping("/create")
    public ResponseEntity<?> createUser(@RequestBody @Valid UserRequest userRequest) {
        try {
            return ResponseEntity.ok(UserAwaitingConfirmationResponse.fromUserAwaitingConfirmation(userService.createUser(userRequest)));
        } catch (UserAlreadyExistsException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
        catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Public endpoint to confirm a user through email confirmation.
     * @param confirmationToken The confirmation token.
     * @return The confirmed user.
     */
    @GetMapping("/confirm/{confirmationToken}")
    public ResponseEntity<?> confirmUser(@PathVariable @Valid String confirmationToken) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.confirmUser(confirmationToken)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Admin endpoint to create a new user. Used for admin to create a user manually.
     * @param userRequest The request to create a user.
     * @return The created user.
     */
    @PostMapping("/create/admin")
    public ResponseEntity<?> createUserAdmin(@RequestBody @Valid UserRequest userRequest) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.createUserAdmin(userRequest)));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (UserAlreadyExistsException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
        catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }
    
    /**
     * Admin endpoint to approve a user.
     * @param email The email of the user.
     * @param reason The optionalreason for approving the user.
     * @return The approved user.
     */
    @PutMapping("/approve/{email}")
    public ResponseEntity<?> approveUser(@PathVariable @Valid String email, @RequestBody @Valid String reason) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.changeRegistrationStatus(email, RegistrationStatus.APPROVED, reason)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Admin endpoint to reject a user.
     * @param email The email of the user.
     * @param reason The optional reason for rejecting the user.
     * @return The rejected user.
     */
    @PutMapping("/reject/{email}")
    public ResponseEntity<?> rejectUser(@PathVariable @Valid String email, @RequestBody @Valid String reason) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.changeRegistrationStatus(email, RegistrationStatus.REJECTED, reason)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Admin endpoint to block a user.
     * @param email The email of the user.
     * @param reason The optional reason for blocking the user.
     * @return The blocked user.
     */
    @PutMapping("/block/{email}")
    public ResponseEntity<?> blockUser(@PathVariable @Valid String email, @RequestBody @Valid String reason) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.changeRegistrationStatus(email, RegistrationStatus.BLOCKED, reason)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Admin endpoint to deactivate a user.
     * @param email The email of the user.
     * @param reason The optional reason for deactivating the user.
     * @return The deactivated user.
     */
    @PutMapping("/deactivate/{email}")
    public ResponseEntity<?> deactivateUser(@PathVariable @Valid String email, @RequestBody @Valid String reason) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.changeRegistrationStatus(email, RegistrationStatus.DEACTIVATED, reason)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PutMapping("/modify/{email}")
    public ResponseEntity<?> modifyUser(@PathVariable @Valid String email, @RequestBody @Valid UserRequest userRequest) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.modifyUser(email, userRequest)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Gets the current user.
     * @return The current user.
     */
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {  
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.getCurrentUser()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Gets all users. Only available for administrators, office personnel or regional managers.
     * @return The users.
     */
    @GetMapping("/all")
    public ResponseEntity<?> getAllUsers() {
        try {    
            return ResponseEntity.ok(userService.getAllUsers());
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Gets all users with PENDING status. Only available for administrators, office personnel or regional managers.
     * @return The users.
     */
    @GetMapping("/all/{status}")
    public ResponseEntity<?> getAllUsersByStatus(@PathVariable @Valid RegistrationStatus status) {
        try {
            return ResponseEntity.ok(userService.getAllUsersByStatus(status));
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    /**
     * Finds a user by their email.
     * @param email The email of the user.
     * @return The user.
     */ 
    @GetMapping("/{email}")
    public ResponseEntity<?> findByEmail(@PathVariable String email) {
        try {
            return ResponseEntity.ok(UserResponse.fromUser(userService.findByEmail(email)));
        } catch (UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }
}
