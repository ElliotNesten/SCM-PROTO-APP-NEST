package se.scm.backend.integration;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;
import se.scm.backend.user.model.EmployeeRoleCode;
import se.scm.backend.user.model.RegistrationStatus;
import se.scm.backend.user.model.User;
import se.scm.backend.testsupport.BackendIntegrationTestBase;

@Transactional
class AdminUserStatusChangeIntegrationTest extends BackendIntegrationTestBase {

    private String emailInPath(String email) {
        return URLEncoder.encode(email, StandardCharsets.UTF_8);
    }

    private void putAdminEndpoint(String url, Object reason, String bearerToken, int expectedStatus) throws Exception {
        var req = put(url)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reason));

        if (bearerToken != null) {
            req = req.header("Authorization", "Bearer " + bearerToken);
        }

        if (expectedStatus == 401) {
            mockMvc.perform(req).andExpect(status().isUnauthorized());
        } else if (expectedStatus == 403) {
            mockMvc.perform(req).andExpect(status().isForbidden());
        } else if (expectedStatus == 400) {
            mockMvc.perform(req).andExpect(status().isBadRequest());
        } else if (expectedStatus == 200) {
            mockMvc.perform(req).andExpect(status().isOk());
        } else {
            mockMvc.perform(req).andExpect(status().is(expectedStatus));
        }
    }

    @Test
    void approve_endpoint_requiresJwt_401() throws Exception {
        mockMvc.perform(put("/api/user/approve/test@example.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"reason\""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void approve_endpoint_requiresRegionManagerOrHigher_403() throws Exception {
        String actorEmail = "actor-temporary-gig@example.com";
        User actor = createUser(
                actorEmail,
                "Actor",
                "LowRole",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.TEMPORARY_GIG_MANAGER)
        );

        String targetEmail = "target-pending@example.com";
        createUser(
                targetEmail,
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        putAdminEndpoint(
                "/api/user/approve/" + emailInPath(targetEmail),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void approve_endpoint_demotionPrevention_403() throws Exception {
        User actor = createUser(
                "actor-region-manager@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        // Same highest role level as actor => forbidden by demotion prevention.
        createUser(
                "target-region-manager@example.com",
                "Target",
                "RM",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        putAdminEndpoint(
                "/api/user/approve/" + emailInPath("target-region-manager@example.com"),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void approve_endpoint_whenTargetNotPending_returns400() throws Exception {
        User actor = createUser(
                "actor-region-manager-approve@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        // Non-pending => service throws IllegalArgumentException.
        createUser(
                "target-not-pending-approve@example.com",
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.REJECTED,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        mockMvc.perform(put("/api/user/approve/" + emailInPath("target-not-pending-approve@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString("Reason"))
                        .header("Authorization", "Bearer " + jwtForEmail(actor.getEmail())))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("cannot be approved or rejected")));
    }

    @Test
    void reject_endpoint_requiresJwt_401() throws Exception {
        mockMvc.perform(put("/api/user/reject/test@example.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"reason\""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void reject_endpoint_requiresRegionManagerOrHigher_403() throws Exception {
        User actor = createUser(
                "actor-temporary-gig-reject@example.com",
                "Actor",
                "LowRole",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.TEMPORARY_GIG_MANAGER)
        );

        String targetEmail = "target-pending-reject@example.com";
        createUser(
                targetEmail,
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        putAdminEndpoint(
                "/api/user/reject/" + emailInPath(targetEmail),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void reject_endpoint_demotionPrevention_403() throws Exception {
        User actor = createUser(
                "actor-region-manager-reject@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        createUser(
                "target-region-manager-reject@example.com",
                "Target",
                "RM",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        putAdminEndpoint(
                "/api/user/reject/" + emailInPath("target-region-manager-reject@example.com"),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void reject_endpoint_whenTargetNotPending_returns400() throws Exception {
        User actor = createUser(
                "actor-region-manager-reject-not-pending@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        // For reject, we want non-PENDING target. Update via service isn't in this test,
        // so create it directly as APPROVED.
        createUser(
                "target-not-pending-reject@example.com",
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.APPROVED,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        mockMvc.perform(put("/api/user/reject/" + emailInPath("target-not-pending-reject@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString("Reason"))
                        .header("Authorization", "Bearer " + jwtForEmail(actor.getEmail())))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("cannot be approved or rejected")));
    }

    @Test
    void block_endpoint_requiresJwt_401() throws Exception {
        mockMvc.perform(put("/api/user/block/test@example.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"reason\""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void block_endpoint_requiresRegionManagerOrHigher_403() throws Exception {
        User actor = createUser(
                "actor-temporary-gig-block@example.com",
                "Actor",
                "LowRole",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.TEMPORARY_GIG_MANAGER)
        );

        String targetEmail = "target-pending-block@example.com";
        createUser(
                targetEmail,
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        putAdminEndpoint(
                "/api/user/block/" + emailInPath(targetEmail),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void block_endpoint_demotionPrevention_403() throws Exception {
        User actor = createUser(
                "actor-region-manager-block@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        createUser(
                "target-region-manager-block@example.com",
                "Target",
                "RM",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        putAdminEndpoint(
                "/api/user/block/" + emailInPath("target-region-manager-block@example.com"),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void deactivate_endpoint_requiresJwt_401() throws Exception {
        mockMvc.perform(put("/api/user/deactivate/test@example.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("\"reason\""))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deactivate_endpoint_requiresRegionManagerOrHigher_403() throws Exception {
        User actor = createUser(
                "actor-temporary-gig-deactivate@example.com",
                "Actor",
                "LowRole",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.TEMPORARY_GIG_MANAGER)
        );

        String targetEmail = "target-pending-deactivate@example.com";
        createUser(
                targetEmail,
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        putAdminEndpoint(
                "/api/user/deactivate/" + emailInPath(targetEmail),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void deactivate_endpoint_demotionPrevention_403() throws Exception {
        User actor = createUser(
                "actor-region-manager-deactivate@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        createUser(
                "target-region-manager-deactivate@example.com",
                "Target",
                "RM",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        putAdminEndpoint(
                "/api/user/deactivate/" + emailInPath("target-region-manager-deactivate@example.com"),
                "Reason",
                jwtForEmail(actor.getEmail()),
                403
        );
    }

    @Test
    void deactivate_endpoint_whenTargetPending_returns400() throws Exception {
        User actor = createUser(
                "actor-region-manager-deactivate-not-allowed@example.com",
                "Actor",
                "RM",
                "+4611112222",
                RegistrationStatus.ACTIVATED,
                "Password123!",
                Set.of(EmployeeRoleCode.REGION_MANAGER)
        );

        createUser(
                "target-pending-deactivate-not-allowed@example.com",
                "Target",
                "User",
                "+4610000000",
                RegistrationStatus.PENDING,
                "Password123!",
                Set.of(EmployeeRoleCode.STAFF)
        );

        mockMvc.perform(put("/api/user/deactivate/" + emailInPath("target-pending-deactivate-not-allowed@example.com"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString("Reason"))
                        .header("Authorization", "Bearer " + jwtForEmail(actor.getEmail())))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("still pending and cannot be deactivated")));
    }
}

