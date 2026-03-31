package se.scm.backend.tempdev;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class PasswordHashGenerator {
    public static void main(String[] args) {
        var encoder = new BCryptPasswordEncoder();
        String rawPassword = "PASSWORD HERE";
        String hash = encoder.encode(rawPassword);
        System.out.println(hash);
    }
}
