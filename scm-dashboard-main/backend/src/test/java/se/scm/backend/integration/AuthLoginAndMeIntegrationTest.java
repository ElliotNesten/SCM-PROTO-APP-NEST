package se.scm.backend.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MvcResult;
import se.scm.backend.auth.dto.LoginRequest;
import se.scm.backend.auth.dto.LoginResponse;
import se.scm.backend.user.dto.UserResponse;
import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.testsupport.BackendIntegrationTestBase;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@Transactional
class AuthLoginAndMeIntegrationTest extends BackendIntegrationTestBase {

    @Test
    void login_withActivatedUserAndCorrectPassword_returns200AndJwt() throws Exception {
        String email = "activated-login@example.com";
        String password = "Password123!";

        User user = createUser(
                email,
                "Activated",
                "User",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                password,
                Set.of(EmployeeRoleCode.STAFF)
        );

        LoginRequest payload = new LoginRequest(email, password);

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andReturn();

        LoginResponse response = objectMapper.readValue(result.getResponse().getContentAsString(), LoginResponse.class);
        assertNotNull(response.token());
        assertTrue(jwtUtil.validateJwtToken(response.token()));
        assertEquals(email, jwtUtil.getUsernameFromToken(response.token()));

        // Sanity: user exists in DB with activated status.
        assertEquals(RegistrationStatus.ACTIVATED, user.getStatus());
    }

    @Test
    void login_withActivatedUserAndIncorrectPassword_returns401InvalidCredentials() throws Exception {
        String email = "activated-wrong-password@example.com";
        String password = "Password123!";

        createUser(
                email,
                "Activated",
                "User",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                password,
                Set.of(EmployeeRoleCode.STAFF)
        );

        LoginRequest payload = new LoginRequest(email, "wrong-password");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string("Invalid credentials"));
    }

    @ParameterizedTest
    @EnumSource(value = RegistrationStatus.class, names = {"PENDING", "APPROVED", "BLOCKED"})
    void login_withNonActivatedUser_returns401InvalidCredentials(RegistrationStatus nonActivatedStatus) throws Exception {
        String email = "non-activated-" + nonActivatedStatus.name().toLowerCase() + "@example.com";
        String password = "Password123!";

        createUser(
                email,
                "User",
                "NonActivated",
                "+4611112222",
                nonActivatedStatus,
                password,
                Set.of(EmployeeRoleCode.STAFF)
        );

        LoginRequest payload = new LoginRequest(email, password);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string("Invalid credentials"));
    }

    @Test
    void getMe_withoutAuthorization_returns401() throws Exception {
        mockMvc.perform(get("/api/user/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getMe_withInvalidJwt_returns401() throws Exception {
        mockMvc.perform(get("/api/user/me")
                        .header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getMe_withExpiredJwt_returns401() throws Exception {
        String email = "expired-jwt@example.com";
        createUser(
                email,
                "Expired",
                "Jwt",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        String expiredToken = expiredJwtForEmail(email, java.time.Duration.ofHours(2));

        mockMvc.perform(get("/api/user/me")
                        .header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getMe_withValidJwt_returnsUserResponse() throws Exception {
        String email = "me-valid-jwt@example.com";
        User user = createUser(
                email,
                "Me",
                "Valid",
                "+46123456789",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        String token = jwtForEmail(email);
        UserResponse expected = UserResponse.fromUser(user);

        MvcResult result = mockMvc.perform(get("/api/user/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        UserResponse actual = objectMapper.readValue(result.getResponse().getContentAsString(), UserResponse.class);

        assertEquals(expected.id(), actual.id());
        assertEquals(expected.email(), actual.email());
        assertEquals(expected.firstName(), actual.firstName());
        assertEquals(expected.lastName(), actual.lastName());
        assertEquals(expected.phoneNumber(), actual.phoneNumber());
        assertEquals(expected.status(), actual.status());

        // Jackson can serialize Instants with millisecond precision, so compare millis.
        assertEquals(expected.createdAt().toEpochMilli(), actual.createdAt().toEpochMilli());
        assertEquals(expected.updatedAt().toEpochMilli(), actual.updatedAt().toEpochMilli());
    }
}

