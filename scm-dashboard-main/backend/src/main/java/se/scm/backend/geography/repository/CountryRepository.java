package se.scm.backend.geography.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import se.scm.backend.geography.model.Country;

public interface CountryRepository extends JpaRepository<Country, UUID> {
    Optional<Country> findById(UUID id);
    boolean existsById(UUID id);
    Optional<Country> findByName(String name);
    boolean existsByName(String name);
    Optional<Country> findByCountryCode(String countryCode);
    boolean existsByCountryCode(String countryCode);
}
