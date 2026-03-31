package se.scm.backend.user.model;

import java.time.Instant;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Setter;
import se.scm.backend.document.model.Document;
import se.scm.backend.geography.model.Country;
import se.scm.backend.geography.model.Region;

@Entity
@Table(name = "employee_profile")
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
public class EmployeeProfile {
    @Id
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @EqualsAndHashCode.Include
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "main_country_id")
    private Country mainCountry;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "main_region_id")
    private Region mainRegion;

    @Column(nullable = false)
    private String bankAccountClearingNumberEncrypted;

    @Column(nullable = false)
    private String bankAccountNumberEncrypted;
    
    @Column(nullable = false)
    private String personalNumberEncrypted;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_photo_doc_id", nullable = false)
    private Document profilePhotoDoc;

    @Column(nullable = false)
    private boolean profileApproved;

    @OneToMany(mappedBy = "employeeProfile", fetch = FetchType.LAZY)
    private Set<ProfileComment> profileComments;

    @Column(nullable = false, updatable = false)
    @Setter(lombok.AccessLevel.NONE)
    private Instant createdAt;

    @Column(nullable = false)
    @Setter(lombok.AccessLevel.NONE)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}