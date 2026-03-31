package se.scm.backend.testsupport;

import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import se.scm.backend.common.service.EmailService;

@Configuration
public class EmailServiceMockConfig {
    @Bean
    @Primary
    public EmailService emailService() {
        // Prevent real SMTP calls during integration tests.
        return Mockito.mock(EmailService.class);
    }
}

