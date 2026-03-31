package se.scm.backend.common.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import se.scm.backend.user.model.UserAwaitingConfirmation;

@Service
public class EmailService {
    private final JavaMailSender mailSender;

    @Value("${server.host}")
    private String host;
    @Value("${server.port}")
    private int port;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * Sends a confirmation token to the user's email.
     * @param userAwaitingConfirmation The user awaiting confirmation.
     * @param confirmationToken The confirmation token.
     */
    public void sendConfirmationToken(UserAwaitingConfirmation userAwaitingConfirmation, String confirmationToken) {
        MimeMessage message = mailSender.createMimeMessage();

        MimeMessageHelper helper;
        try {
            helper = new MimeMessageHelper(message, true);
            helper.setFrom("no-reply@scm.se");
            helper.setTo(userAwaitingConfirmation.getPendingEmail());
            helper.setSubject("Confirm your email address");
            String confirmationUrl = "http://" + host + ":" + port + "/api/user/confirm/" + confirmationToken;
            helper.setText("Click the link below to confirm your email address: \n\n" + "<a href=\"" + confirmationUrl + "\">Confirm email</a>", true);
            message.addHeader("X-PM-Message-Stream", "confirm");
            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send confirmation token to user's email", e);
        }
    }     
}
