package se.scm.backend.user.model;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import se.scm.backend.common.model.BaseEntity;

/**
 * Stores registration status and role assignment changes for {@link User}.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_change_history")
public class UserChangeHistory extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actorUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_user_id", nullable = false)
    private User targetUser;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 50)
    private EventType eventType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "platform_user_employee_role_id")
    private UserEmployeeRole platformUserEmployeeRole;

    @Column(name = "employee_role_id")
    private UUID employeeRoleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_before", length = 50)
    private RegistrationStatus statusBefore;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_after", length = 50)
    private RegistrationStatus statusAfter;

    @Column(name = "active_before")
    private Boolean activeBefore;

    @Column(name = "active_after")
    private Boolean activeAfter;

    @Column(name = "reason")
    private String reason;

    /**
     * Factory for capturing user registration/status transitions.
     * @param actorUser The user who caused the change, if applicable.
     * @param targetUser The user who the change was applied to.
     * @param statusBefore The status before the change.
     * @param statusAfter The status after the change.
     * @param reason The reason for the change, if applicable.
     * @return The created UserChangeHistory.
     */
    public static UserChangeHistory userStatusChange(
            User actorUser,
            User targetUser,
            RegistrationStatus statusBefore,
            RegistrationStatus statusAfter,
            String reason) {
        UserChangeHistory history = new UserChangeHistory();
        history.setActorUser(actorUser);
        history.setTargetUser(targetUser);
        history.setEventType(EventType.USER_STATUS_CHANGE);
        history.setStatusBefore(statusBefore);
        history.setStatusAfter(statusAfter);
        history.setReason(reason);
        return history;
    }

    /**
     * Factory for capturing employee role assignment activate/deactivate transitions.
     * @param actorUser The user who caused the change, if applicable.
     * @param targetUser The user who the change was applied to.
     * @param platformUserEmployeeRole The platform user employee role that was activated/deactivated.
     * @param employeeRoleId The id of the employee role that was activated/deactivated.
     * @param activeBefore The active status before the change.
     * @param activeAfter The active status after the change.
     * @param reason The reason for the change, if applicable.
     * @return The created UserChangeHistory.
     */
    public static UserChangeHistory userEmployeeRoleActivate(
            User actorUser,
            User targetUser,
            UserEmployeeRole platformUserEmployeeRole,
            UUID employeeRoleId,
            boolean activeBefore,
            boolean activeAfter,
            String reason) {
        UserChangeHistory history = new UserChangeHistory();
        history.setActorUser(actorUser);
        history.setTargetUser(targetUser);
        history.setEventType(EventType.USER_EMPLOYEE_ROLE_ACTIVATE);
        history.setPlatformUserEmployeeRole(platformUserEmployeeRole);
        history.setEmployeeRoleId(employeeRoleId);
        history.setActiveBefore(activeBefore);
        history.setActiveAfter(activeAfter);
        history.setReason(reason);
        return history;
    }
}

