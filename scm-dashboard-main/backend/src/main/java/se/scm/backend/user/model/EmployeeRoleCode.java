package se.scm.backend.user.model;

/**
 * Represents the code for an employee role. Used to determine the level of access a user has.
 * @author Oliwer Carpman
 * @version 1.0
 * @see EmployeeRole
 */
public enum EmployeeRoleCode {
    SUPER_ADMIN(5), // Global access to the entire platform
    OFFICE_PERSONNEL(4), // Most of the same access as SUPER_ADMIN but can't change contracts or policies
    REGION_MANAGER(3), // Operative access within a region or country
    TEMPORARY_GIG_MANAGER(2), // Operative access within a specific gig
    STAFF(1) // Only able to access their own profile, shifts, documents and material specific to their shift roles
    ;

    private final int level;

    private EmployeeRoleCode(int level) {
        this.level = level;
    }

    public int getLevel() {
        return level;
    }
}
