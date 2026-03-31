drop table if exists test_table;

create table country (
    id uuid primary key,
    name varchar(255) not null unique,
    country_code varchar(255) not null unique
);

create table region (
    id uuid primary key,
    name varchar(255) not null unique,
    country_id uuid not null references country(id)
);

create index idx_region_country_id on region (country_id);

insert into country (id, name, country_code)
values
    (gen_random_uuid(), 'Sweden', 'SE'),
    (gen_random_uuid(), 'Norway', 'NO'),
    (gen_random_uuid(), 'Denmark', 'DK'),
    (gen_random_uuid(), 'Finland', 'FI');

insert into region (id, name, country_id)
values
    (gen_random_uuid(), 'Stockholm', (select id from country where country_code = 'SE')),
    (gen_random_uuid(), 'Gothenburg', (select id from country where country_code = 'SE')),
    (gen_random_uuid(), 'Malmö', (select id from country where country_code = 'SE'));