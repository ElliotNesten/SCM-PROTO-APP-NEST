package se.scm.backend.user.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import se.scm.backend.user.model.EmployeeRole;
import se.scm.backend.user.model.EmployeeRoleCode;

public interface EmployeeRoleRepository extends JpaRepository<EmployeeRole, UUID> {
    Optional<EmployeeRole> findByEmployeeRoleCode(EmployeeRoleCode employeeRoleCode);
}

