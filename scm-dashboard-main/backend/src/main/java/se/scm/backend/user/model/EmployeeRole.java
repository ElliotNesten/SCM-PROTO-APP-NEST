package se.scm.backend.user.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import se.scm.backend.common.model.BaseEntity;

/**
 * Represents a role for office personnel.
 * @author Oliwer Carpman
 * @version 1.0
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "employee_role")
public class EmployeeRole extends BaseEntity {
    @Column(nullable = false, unique = true)
    private String name;
    
    @Column(nullable = false, unique = true)
    @Enumerated(EnumType.STRING)
    private EmployeeRoleCode employeeRoleCode;
}
