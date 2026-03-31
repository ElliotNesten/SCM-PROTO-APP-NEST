package se.scm.backend.testsupport;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Base class for integration tests that require a real Postgres database.
 * Flyway migrations will run on startup using the container database.
 */
@SpringBootTest
@Testcontainers
public abstract class AbstractPostgresIntegrationTest {

    // Use a stable Postgres image for tests.
    @Container
    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("scm_dashboard_test")
            .withUsername("postgres")
            .withPassword("postgres")
            // Required by Flyway seed scripts using gen_random_uuid().
            .withInitScript("db/init_pgcrypto.sql");

    @DynamicPropertySource
    static void registerDataSourceProperties(DynamicPropertyRegistry registry) {
        registry.add("SPRING_DATASOURCE_URL", postgres::getJdbcUrl);
        registry.add("SPRING_DATASOURCE_USERNAME", postgres::getUsername);
        registry.add("SPRING_DATASOURCE_PASSWORD", postgres::getPassword);
    }
}

