insert into employee_role (id, name, employee_role_code, created_at, updated_at)
values
  (gen_random_uuid(), 'Super admin', 'SUPER_ADMIN', now(), now()),
  (gen_random_uuid(), 'Office personnel', 'OFFICE_PERSONNEL', now(), now()),
  (gen_random_uuid(), 'Region manager', 'REGION_MANAGER', now(), now()),
  (gen_random_uuid(), 'Temporary gig manager', 'TEMPORARY_GIG_MANAGER', now(), now()),
  (gen_random_uuid(), 'Staff', 'STAFF', now(), now())
on conflict (employee_role_code) do nothing;