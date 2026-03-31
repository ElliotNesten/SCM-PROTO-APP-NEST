package se.scm.backend.security.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.user.repository.UserEmployeeRoleRepository;
import se.scm.backend.user.repository.UserRepository;

/**
 * Custom implementation of UserDetailsService. Loads user details by email.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {
    private final UserRepository userRepository;
    private final UserEmployeeRoleRepository userEmployeeRoleRepository;

    public CustomUserDetailsService(UserRepository userRepository, UserEmployeeRoleRepository userEmployeeRoleRepository) {
        this.userRepository = userRepository;
        this.userEmployeeRoleRepository = userEmployeeRoleRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        List<EmployeeRoleCode> roleCodes = userEmployeeRoleRepository.findActiveEmployeeRoleCodesByUserId(user.getId());

        List<GrantedAuthority> authorities = roleCodes.stream()
                .map(code -> new SimpleGrantedAuthority("ROLE_" + code.name()))
                .collect(Collectors.toList());

        // Only activated users can log in.
        boolean enabled = user.getStatus() == RegistrationStatus.ACTIVATED;

        // Password is the encoded passwordHash (BCrypt). AuthenticationManager uses PasswordEncoder to verify.
        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                enabled,
                true,  // accountNonExpired
                true,  // credentialsNonExpired
                true,  // accountNonLocked
                authorities
        );
    }
}

