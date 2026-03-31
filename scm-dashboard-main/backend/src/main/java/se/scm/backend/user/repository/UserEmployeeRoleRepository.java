package se.scm.backend.user.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.UserEmployeeRole;

public interface UserEmployeeRoleRepository extends JpaRepository<UserEmployeeRole, UUID> {
    List<UserEmployeeRole> findByUser_IdAndActiveTrue(UUID userId);

    // Selects the employee role codes for all active roles for a user.
    @Query("""
            select ur.employeeRole.employeeRoleCode
            from UserEmployeeRole ur
            where ur.user.id = :userId
              and ur.active = true
            """)
    List<EmployeeRoleCode> findActiveEmployeeRoleCodesByUserId(@Param("userId") UUID userId);

    // Selects the user employee role for a user and employee role if it is active.
    @Query("""
            select ur
            from UserEmployeeRole ur
            where ur.user.id = :userId
              and ur.employeeRole.id = :employeeRoleId
              and ur.active = true
            """)
    Optional<UserEmployeeRole> findActiveByUserIdAndEmployeeRoleId(
            @Param("userId") UUID userId,
            @Param("employeeRoleId") UUID employeeRoleId);
}
