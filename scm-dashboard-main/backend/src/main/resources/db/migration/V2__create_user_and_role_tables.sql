create table platform_user (
    id uuid primary key,
    email varchar(255) not null unique,
    phone_number varchar(20) unique,
    first_name varchar(100) not null,
    last_name varchar(100) not null,
    password_hash varchar(255) not null,
    status varchar(50) not null,
    created_at timestamp not null,
    updated_at timestamp not null
);
create table employee_role (
    id uuid primary key,
    name varchar(100) not null unique,
    employee_role_code varchar(50) not null unique,
    created_at timestamp not null,
    updated_at timestamp not null
);
create table platform_user_employee_role (
    id uuid primary key,
    platform_user_id uuid not null references platform_user(id),
    employee_role_id uuid not null references employee_role(id),
    active boolean not null default true,
    created_at timestamp not null,
    updated_at timestamp not null
);