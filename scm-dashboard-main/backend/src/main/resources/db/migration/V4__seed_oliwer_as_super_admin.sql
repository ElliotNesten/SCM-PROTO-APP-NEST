insert into platform_user (
  id, email, phone_number, first_name, last_name,
  password_hash, status, created_at, updated_at
)
select
  gen_random_uuid(),
  'oliwer@scm.se',
  '+46702322446',
  'Oliwer',
  'Carpman',
  '$2a$10$w3HBB19YDhI9chWlwNPkG.GQL9JY1fy8lQ6X7ZWDiheXoGijaBC..',
  'ACTIVATED',
  now(),
  now()
where not exists (
  select 1 from platform_user where email = 'oliwer@scm.se'
);

insert into platform_user_employee_role (
  id, platform_user_id, employee_role_id, active, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  r.id,
  true,
  now(),
  now()
from platform_user u
join employee_role r
  on r.employee_role_code = 'SUPER_ADMIN'
where u.email = 'oliwer@scm.se'
and not exists (
  select 1
  from platform_user_employee_role ur
  where ur.platform_user_id = u.id
    and ur.employee_role_id = r.id
);