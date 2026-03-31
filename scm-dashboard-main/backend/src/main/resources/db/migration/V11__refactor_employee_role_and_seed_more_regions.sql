alter table platform_user_employee_role add column country_id uuid references country(id);
alter table platform_user_employee_role add column region_id uuid references region(id);

insert into region (id, name, country_id)
values
    (gen_random_uuid(), 'Oslo', (select id from country where country_code = 'NO')),
    (gen_random_uuid(), 'Stavanger', (select id from country where country_code = 'NO')),
    (gen_random_uuid(), 'Trondheim', (select id from country where country_code = 'NO')),
    (gen_random_uuid(), 'Bergen', (select id from country where country_code = 'NO')),
    (gen_random_uuid(), 'Herning', (select id from country where country_code = 'DK'));