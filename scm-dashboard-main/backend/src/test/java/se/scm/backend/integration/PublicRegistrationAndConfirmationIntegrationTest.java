package se.scm.backend.integration;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import se.scm.backend.user.dto.UserAwaitingConfirmationResponse;
import se.scm.backend.user.dto.UserRequest;
import se.scm.backend.testsupport.BackendIntegrationTestBase;
import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.user.dto.UserResponse;

import static org.junit.jupiter.api.Assertions.*;

import org.springframework.test.web.servlet.MvcResult;

@Transactional
class PublicRegistrationAndConfirmationIntegrationTest extends BackendIntegrationTestBase {

    @Test
    void createUser_validPayload_returns200_andAwaitingConfirmationResponseMatchesRequest() throws Exception {
        UUID countryId = defaultCountryId();
        UUID regionId = defaultRegionId();

        String email = "register-valid@example.com";
        UserRequest request = new UserRequest(
                email,
                "First",
                "Last",
                "+46",
                "0123456789",
                countryId,
                regionId,
                "Password123!",
                "Password123!"
        );

        AtomicReference<String> capturedToken = new AtomicReference<>();
        captureEmailConfirmationToken(capturedToken);

        MvcResult result = mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.firstName").value(request.firstName()))
                .andExpect(jsonPath("$.lastName").value(request.lastName()))
                .andExpect(jsonPath("$.phoneNumber").value(request.getPhoneNumber()))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();

        UserAwaitingConfirmationResponse response = objectMapper.readValue(
                result.getResponse().getContentAsString(),
                UserAwaitingConfirmationResponse.class
        );

        assertEquals(email, response.email());
        assertEquals(request.firstName(), response.firstName());
        assertEquals(request.lastName(), response.lastName());
        assertEquals(request.getPhoneNumber(), response.phoneNumber());
        assertEquals("PENDING", response.status());
        assertNotNull(response.expiresAt());
        assertTrue(response.expiresAt().isAfter(Instant.now()));

        // DB assertion: awaiting confirmation row exists and is not expired.
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "select pending_email, expires_at from user_awaiting_confirmation where pending_email = ? limit 1",
                email
        );
        assertEquals(email, row.get("pending_email"));

        Object expiresAtObj = row.get("expires_at");
        Instant expiresAt = expiresAtObj instanceof Timestamp ts ? ts.toInstant() : (Instant) expiresAtObj;
        assertTrue(expiresAt.isAfter(Instant.now()));

        assertNotNull(capturedToken.get(), "EmailService.sendConfirmationToken should have been called with a token");
    }

    @Test
    void createUser_invalidPayload_returns400() throws Exception {
        UUID countryId = defaultCountryId();

        UserRequest invalidEmail = new UserRequest(
                "not-an-email",
                "First",
                "Last",
                "+46",
                "0123456789",
                countryId,
                defaultRegionId(),
                "Password123!",
                "Password123!"
        );

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidEmail)))
                .andExpect(status().isBadRequest());

        UserRequest invalidPhoneLanguageCode = new UserRequest(
                "invalid-phone@example.com",
                "First",
                "Last",
                "46",
                "0123456789",
                countryId,
                defaultRegionId(),
                "Password123!",
                "Password123!"
        );

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidPhoneLanguageCode)))
                .andExpect(status().isBadRequest());

        UserRequest blankPassword = new UserRequest(
                "invalid-password@example.com",
                "First",
                "Last",
                "+46",
                "0123456789",
                countryId,
                defaultRegionId(),
                "",
                ""
        );

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(blankPassword)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createUser_whenUserAlreadyPending_returns409AlreadyPendingError() throws Exception {
        UUID countryId = defaultCountryId();
        UUID regionId = defaultRegionId();

        String email = "register-already-pending@example.com";
        createUser(
                email,
                "Existing",
                "Pending",
                "+4611112222",
                RegistrationStatus.PENDING,
                "irrelevant",
                Set.of(EmployeeRoleCode.STAFF)
        );

        UserRequest request = new UserRequest(
                email,
                "New",
                "Names",
                "+46",
                "0123456789",
                countryId,
                regionId,
                "Password123!",
                "Password123!"
        );

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(content().string(containsString("already pending")));
    }

    @ParameterizedTest
    @EnumSource(value = RegistrationStatus.class, names = {"REJECTED", "DEACTIVATED"})
    void createUser_forRejectedOrDeactivated_replacesAwaitingConfirmationAndCreatesNewToken(RegistrationStatus previousStatus) throws Exception {
        UUID countryId = defaultCountryId();
        UUID regionId = defaultRegionId();

        String email = "register-replace-token@example.com";

        // Existing rejected/deactivated user should allow re-applying.
        createUser(
                email,
                "Existing",
                previousStatus == RegistrationStatus.REJECTED ? "Rejected" : "Deactivated",
                "+4611112222",
                previousStatus,
                "some-password",
                Set.of(EmployeeRoleCode.STAFF)
        );

        String oldToken = "old-confirm-token";
        String oldTokenHash = org.springframework.util.DigestUtils.md5DigestAsHex(oldToken.getBytes());

        insertAwaitingConfirmation(
                email,
                "OldFirst",
                "OldLast",
                "+4610000000",
                countryId,
                regionId,
                "Password123!",
                oldToken,
                Instant.now().minus(Duration.ofHours(2)),
                Instant.now().plus(Duration.ofDays(1))
        );

        assertTrue(
                jdbcTemplate.queryForObject(
                        "select count(*) from user_awaiting_confirmation where confirmation_token_hash = ?",
                        Long.class,
                        oldTokenHash
                ) > 0
        );

        UserRequest request = new UserRequest(
                email,
                "ReplacedFirst",
                "ReplacedLast",
                "+46",
                "0123456789",
                countryId,
                regionId,
                "Password123!",
                "Password123!"
        );

        AtomicReference<String> capturedToken = new AtomicReference<>();
        captureEmailConfirmationToken(capturedToken);

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        String newToken = capturedToken.get();
        assertNotNull(newToken);
        assertNotEquals(oldToken, newToken);

        String newTokenHash = org.springframework.util.DigestUtils.md5DigestAsHex(newToken.getBytes());

        Long awaitingCount = jdbcTemplate.queryForObject(
                "select count(*) from user_awaiting_confirmation where pending_email = ?",
                Long.class,
                email
        );
        assertEquals(1L, awaitingCount);

        Long oldTokenCount = jdbcTemplate.queryForObject(
                "select count(*) from user_awaiting_confirmation where confirmation_token_hash = ?",
                Long.class,
                oldTokenHash
        );
        assertEquals(0L, oldTokenCount);

        Long newTokenCount = jdbcTemplate.queryForObject(
                "select count(*) from user_awaiting_confirmation where confirmation_token_hash = ?",
                Long.class,
                newTokenHash
        );
        assertEquals(1L, newTokenCount);
    }

    @Test
    void confirmUser_validToken_createsOrUpdatesUser_setsPendingRoleDeletesAwaitingRow() throws Exception {
        UUID countryId = defaultCountryId();
        UUID regionId = defaultRegionId();

        String email = "confirm-valid-token@example.com";
        String password = "Password123!";
        String requestPhoneLanguageCode = "+46";
        String requestPhoneNumber = "0123456789";

        UserRequest request = new UserRequest(
                email,
                "ConfirmFirst",
                "ConfirmLast",
                requestPhoneLanguageCode,
                requestPhoneNumber,
                countryId,
                regionId,
                password,
                password
        );

        AtomicReference<String> capturedToken = new AtomicReference<>();
        captureEmailConfirmationToken(capturedToken);

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        String token = capturedToken.get();
        assertNotNull(token);
        String tokenHash = org.springframework.util.DigestUtils.md5DigestAsHex(token.getBytes());

        // Read the pending_password_hash before confirm deletes the awaiting row.
        String pendingPasswordHash = jdbcTemplate.queryForObject(
                "select pending_password_hash from user_awaiting_confirmation where confirmation_token_hash = ?",
                String.class,
                tokenHash
        );
        assertNotNull(pendingPasswordHash);

        // Pre-create an existing user to verify update-path behavior.
        createUser(
                email,
                "ExistingFirst",
                "ExistingLast",
                "+4619998888",
                RegistrationStatus.APPROVED,
                "DifferentPassword123!",
                Set.of()
        );

        MvcResult confirmResult = mockMvc.perform(get("/api/user/confirm/" + token))
                .andExpect(status().isOk())
                .andReturn();

        UserResponse response = objectMapper.readValue(confirmResult.getResponse().getContentAsString(), UserResponse.class);
        assertEquals(email, response.email());
        assertEquals(request.firstName(), response.firstName());
        assertEquals(request.lastName(), response.lastName());
        assertEquals(request.getPhoneNumber(), response.phoneNumber());
        assertEquals("PENDING", response.status());

        // Verify platform_user updated.
        User updated = userRepository.findByEmail(email).orElseThrow();
        assertEquals(RegistrationStatus.PENDING, updated.getStatus());
        assertEquals(pendingPasswordHash, updated.getPasswordHash());

        // Verify STAFF role assigned.
        Long staffRoleCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from platform_user_employee_role ur
                join employee_role r on r.id = ur.employee_role_id
                where ur.platform_user_id = ?
                  and ur.active = true
                  and r.employee_role_code = 'STAFF'
                """,
                Long.class,
                updated.getId()
        );
        assertEquals(1L, staffRoleCount);

        // Verify awaiting confirmation row deleted.
        Long awaitingCount = jdbcTemplate.queryForObject(
                "select count(*) from user_awaiting_confirmation where confirmation_token_hash = ?",
                Long.class,
                tokenHash
        );
        assertEquals(0L, awaitingCount);
    }

    @Test
    void confirmUser_validToken_createsNewUser_setsPendingRoleDeletesAwaitingRow() throws Exception {
        UUID countryId = defaultCountryId();
        UUID regionId = defaultRegionId();

        String email = "confirm-create-new-user@example.com";
        String password = "Password123!";
        String requestPhoneLanguageCode = "+46";
        String requestPhoneNumber = "0123456789";

        UserRequest request = new UserRequest(
                email,
                "CreateFirst",
                "CreateLast",
                requestPhoneLanguageCode,
                requestPhoneNumber,
                countryId,
                regionId,
                password,
                password
        );

        AtomicReference<String> capturedToken = new AtomicReference<>();
        captureEmailConfirmationToken(capturedToken);

        mockMvc.perform(post("/api/user/create")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        String token = capturedToken.get();
        assertNotNull(token);
        String tokenHash = org.springframework.util.DigestUtils.md5DigestAsHex(token.getBytes());

        String pendingPasswordHash = jdbcTemplate.queryForObject(
                "select pending_password_hash from user_awaiting_confirmation where confirmation_token_hash = ?",
                String.class,
                tokenHash
        );
        assertNotNull(pendingPasswordHash);

        MvcResult confirmResult = mockMvc.perform(get("/api/user/confirm/" + token))
                .andExpect(status().isOk())
                .andReturn();

        UserResponse response = objectMapper.readValue(
                confirmResult.getResponse().getContentAsString(),
                UserResponse.class
        );
        assertEquals(email, response.email());
        assertEquals(request.firstName(), response.firstName());
        assertEquals(request.lastName(), response.lastName());
        assertEquals(request.getPhoneNumber(), response.phoneNumber());
        assertEquals("PENDING", response.status());

        User created = userRepository.findByEmail(email).orElseThrow();
        assertEquals(RegistrationStatus.PENDING, created.getStatus());
        assertEquals(pendingPasswordHash, created.getPasswordHash());

        // Verify STAFF role assigned.
        Long staffRoleCount = jdbcTemplate.queryForObject(
                """
                select count(*)
                from platform_user_employee_role ur
                join employee_role r on r.id = ur.employee_role_id
                where ur.platform_user_id = ?
                  and ur.active = true
                  and r.employee_role_code = 'STAFF'
                """,
                Long.class,
                created.getId()
        );
        assertEquals(1L, staffRoleCount);

        Long awaitingCount = jdbcTemplate.queryForObject(
                "select count(*) from user_awaiting_confirmation where confirmation_token_hash = ?",
                Long.class,
                tokenHash
        );
        assertEquals(0L, awaitingCount);
    }

    @Test
    void confirmUser_expiredToken_returns404() throws Exception {
        String email = "confirm-expired@example.com";
        String token = "expired-token-1";

        UUID countryId = defaultCountryId();
        UUID regionId = defaultRegionId();

        insertAwaitingConfirmation(
                email,
                "Expired",
                "Token",
                "+4611112222",
                countryId,
                regionId,
                "Password123!",
                token,
                Instant.now().minus(Duration.ofHours(2)),
                Instant.now().minus(Duration.ofMinutes(10))
        );

        mockMvc.perform(get("/api/user/confirm/" + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void confirmUser_unknownToken_returns404() throws Exception {
        mockMvc.perform(get("/api/user/confirm/unknown-confirm-token"))
                .andExpect(status().isNotFound());
    }
}

