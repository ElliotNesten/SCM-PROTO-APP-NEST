package se.scm.backend.geography.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import se.scm.backend.geography.model.Region;

    public interface RegionRepository extends JpaRepository<Region, UUID> {
    Optional<Region> findById(UUID id);
    boolean existsById(UUID id);
    Optional<Region> findByName(String name);
    boolean existsByName(String name);
    List<Region> findByCountry_Id(UUID countryId);
}
