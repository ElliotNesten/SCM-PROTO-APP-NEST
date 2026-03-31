package se.scm.backend.user.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import se.scm.backend.common.model.BaseEntity;
import se.scm.backend.geography.model.Country;
import se.scm.backend.geography.model.Region;

/**
 * Bridges the {@link User} and {@link EmployeeRole} tables to determine which roles a user has.
 * @author Oliwer Carpman
 * @version 1.0
 * @see User
 * @see EmployeeRole
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "platform_user_employee_role")
public class UserEmployeeRole extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "platform_user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_role_id", nullable = false)
    private EmployeeRole employeeRole;

    // If the user has this role for a specific country. If null, the role is valid for all countries.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "country_id")
    private Country country;
    
    // If the user has this role for a specific region. If null, the role is valid for all regions in set country.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "region_id")
    private Region region;
    
    // If the user currently has this role.
    @Column(nullable = false)
    private boolean active = true;
}
