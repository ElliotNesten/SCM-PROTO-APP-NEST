package se.scm.backend.user.model;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.EqualsAndHashCode;
import lombok.Setter;

@Entity
@Table(name = "profile_comment")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class ProfileComment {    
    @Id
    @Column(name = "employee_profile_id", nullable = false)
    @EqualsAndHashCode.Include
    private UUID employeeProfileId;

    @Id
    @Column(name = "commenting_user_id", nullable = false)
    @EqualsAndHashCode.Include
    private UUID commentingUserId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_profile_id", nullable = false, insertable = false, updatable = false)
    private EmployeeProfile employeeProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commenting_user_id", nullable = false, insertable = false, updatable = false)
    private User commentingUser;

    @Column(nullable = false)
    private String comment;

    @Column(nullable = false, updatable = false)
    @Setter(lombok.AccessLevel.NONE)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}
