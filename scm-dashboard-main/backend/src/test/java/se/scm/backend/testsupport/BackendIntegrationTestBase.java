package se.scm.backend.testsupport;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.web.context.WebApplicationContext;
import se.scm.backend.common.service.EmailService;
import se.scm.backend.geography.repository.CountryRepository;
import se.scm.backend.geography.repository.RegionRepository;
import se.scm.backend.security.JwtUtil;
import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.user.model.UserAwaitingConfirmation;
import se.scm.backend.user.model.UserEmployeeRole;
import se.scm.backend.user.repository.EmployeeRoleRepository;
import se.scm.backend.user.repository.UserAwaitingConfirmationRepository;
import se.scm.backend.user.repository.UserEmployeeRoleRepository;
import se.scm.backend.user.repository.UserRepository;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

@Import(EmailServiceMockConfig.class)
public abstract class BackendIntegrationTestBase extends AbstractPostgresIntegrationTest {

    protected ObjectMapper objectMapper;

    @Autowired
    protected WebApplicationContext webApplicationContext;

    @Autowired
    protected JwtUtil jwtUtil;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected EmployeeRoleRepository employeeRoleRepository;

    @Autowired
    protected UserEmployeeRoleRepository userEmployeeRoleRepository;

    @Autowired
    protected UserAwaitingConfirmationRepository userAwaitingConfirmationRepository;

    @Autowired
    protected CountryRepository countryRepository;

    @Autowired
    protected RegionRepository regionRepository;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected EmailService emailService;

    @Value("${security.authentication.jwt.secret}")
    protected String jwtSecret;

    protected MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        // Tests deserialize API responses into DTOs containing `Instant`.
        // Spring's auto-config normally registers JSR-310 support; since we create
        // our own ObjectMapper, we need to do it explicitly.
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .findAndRegisterModules();
        // Ensure Spring Security filter chain is active (otherwise protected endpoints can NPE).
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        Mockito.reset(emailService);
    }

    protected UUID defaultCountryId() {
        return countryRepository.findByCountryCode("SE").orElseThrow().getId();
    }

    protected UUID defaultRegionId() {
        return regionRepository.findByName("Stockholm").orElseThrow().getId();
    }

    protected User createUser(String email,
                               String firstName,
                               String lastName,
                               String phoneNumber,
                               RegistrationStatus status,
                               String rawPassword,
                               Set<EmployeeRoleCode> roles) {
        User user = new User();
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setPhoneNumber(phoneNumber);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setStatus(status);
        User saved = userRepository.save(user);

        if (roles != null && !roles.isEmpty()) {
            for (EmployeeRoleCode roleCode : roles) {
                assignRole(saved, roleCode);
            }
        }

        userRepository.flush();
        return saved;
    }

    protected void assignRole(User user, EmployeeRoleCode roleCode) {
        var employeeRole = employeeRoleRepository.findByEmployeeRoleCode(roleCode)
                .orElseThrow(() -> new RuntimeException("Missing employee role: " + roleCode));

        UserEmployeeRole eur = new UserEmployeeRole();
        eur.setUser(user);
        eur.setEmployeeRole(employeeRole);
        eur.setActive(true);
        eur.setCountry(null);
        eur.setRegion(null);
        userEmployeeRoleRepository.save(eur);
        userEmployeeRoleRepository.flush();
    }

    protected String jwtForEmail(String email) {
        return jwtUtil.generateToken(email);
    }

    protected String expiredJwtForEmail(String email, Duration howLongAgo) {
        Instant now = Instant.now();
        Instant issuedAt = now.minus(howLongAgo);
        Instant expiredAt = now.minusSeconds(1);

        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(java.util.Date.from(issuedAt))
                .setExpiration(java.util.Date.from(expiredAt))
                .signWith(Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
                .compact();
    }

    protected UUID insertAwaitingConfirmation(String pendingEmail,
                                               String pendingFirstName,
                                               String pendingLastName,
                                               String pendingPhoneNumber,
                                               UUID pendingCountryId,
                                               UUID pendingRegionId,
                                               String rawPassword,
                                               String confirmationToken,
                                               Instant createdAt,
                                               Instant expiresAt) {
        String confirmationTokenHash = org.springframework.util.DigestUtils.md5DigestAsHex(confirmationToken.getBytes());
        UserAwaitingConfirmation uac = UserAwaitingConfirmation.builder()
                .pendingEmail(pendingEmail)
                .pendingFirstName(pendingFirstName)
                .pendingLastName(pendingLastName)
                .pendingPhoneNumber(pendingPhoneNumber)
                .pendingCountryId(pendingCountryId)
                .pendingRegionId(pendingRegionId)
                .pendingPasswordHash(passwordEncoder.encode(rawPassword))
                .confirmationTokenHash(confirmationTokenHash)
                .createdAt(createdAt)
                .expiresAt(expiresAt)
                .build();
        // Ensure SQL is written so JDBC assertions (in the same @Transactional test) can see it immediately.
        return userAwaitingConfirmationRepository.save(uac).getId();
    }

    protected void captureEmailConfirmationToken(AtomicReference<String> capturedToken) {
        Mockito.doAnswer(inv -> {
            capturedToken.set(inv.getArgument(1, String.class));
            return null;
        }).when(emailService).sendConfirmationToken(Mockito.any(), Mockito.anyString());
    }

}

