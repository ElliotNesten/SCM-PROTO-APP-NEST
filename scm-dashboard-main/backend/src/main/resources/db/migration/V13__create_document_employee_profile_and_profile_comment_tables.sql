create table document (
    id uuid primary key,
    file_name varchar(255) not null,
    file_type varchar(255) not null,
    file_size bigint not null,
    storage_bucket varchar(255) not null,
    storage_key varchar(255) not null unique,
    uploaded_by_user_id uuid not null references platform_user(id),
    created_at timestamp not null,
    updated_at timestamp not null
);

create table employee_profile (
    user_id uuid not null references platform_user(id) primary key,
    main_country_id uuid references country(id),
    main_region_id uuid references region(id),
    bank_account_clearing_number_encrypted varchar(255) not null,
    bank_account_number_encrypted varchar(255) not null,
    bank_account_name_encrypted varchar(255) not null,
    bank_account_bank_name_encrypted varchar(255) not null,
    personal_number_encrypted varchar(255) not null,
    profile_photo_doc_id uuid not null references document(id),
    profile_approved boolean not null default false,
    created_at timestamp not null,
    updated_at timestamp not null
);

create table profile_comment (
    employee_profile_id uuid not null references employee_profile(user_id),
    commenting_user_id uuid not null references platform_user(id),
    comment text not null,
    created_at timestamp not null,
    primary key (employee_profile_id, commenting_user_id)
);